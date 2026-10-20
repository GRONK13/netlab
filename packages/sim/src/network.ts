import { clone, defaultConfig } from './config.ts';
import { parentInterface } from './interfaces.ts';
import { iosTrees, type IosTrees } from './ios.ts';
import { complete, help, match, type CommandTree, type MatchResult } from './parser.ts';
import { pcTree, PC_PROMPT } from './pc.ts';
import { ping, type PingResult } from './ping.ts';
import type {
  DeviceConfig,
  DeviceKind,
  DeviceSpec,
  InterfaceConfig,
  LinkEnd,
  LogEntry,
  TopologySpec,
} from './types.ts';

export type Mode =
  | 'user'
  | 'priv'
  | 'config'
  | 'config-if'
  | 'config-if-range'
  | 'config-subif'
  | 'config-line'
  | 'config-vlan';

export type Pending =
  | { kind: 'enable'; tries: number }
  | { kind: 'login'; tries: number }
  | { kind: 'press-return' }
  | { kind: 'copy' }
  | { kind: 'reload' };

export interface Session {
  mode: Mode;
  /** Interfaces selected by `interface` / `interface range`. */
  ifaces: string[];
  /** Lines selected by `line con 0` / `line vty a b`. */
  lines: { kind: 'con' | 'vty'; from: number; to: number } | null;
  /** VLANs selected by `vlan 10,20`. */
  vlans: number[];
  pending: Pending | null;
}

export interface Ctx {
  net: Network;
  dev: Device;
}

export class Device {
  readonly id: string;
  readonly kind: DeviceKind;
  readonly spec: DeviceSpec;
  running: DeviceConfig;
  startup: DeviceConfig | null = null;
  session: Session;

  constructor(spec: DeviceSpec) {
    this.id = spec.id;
    this.kind = spec.kind;
    this.spec = spec;
    this.running = defaultConfig(spec);
    this.session = Device.freshSession();
  }

  static freshSession(): Session {
    return { mode: 'user', ifaces: [], lines: null, vlans: [], pending: null };
  }

  get model(): string {
    return this.spec.model ?? (this.kind === 'switch' ? '2960-24TT' : this.kind === 'router' ? '2911' : 'PC');
  }

  iface(name: string): InterfaceConfig | undefined {
    return this.running.interfaces[name];
  }
}

const CONFIG_SUBMODES: Mode[] = ['config-if', 'config-if-range', 'config-subif', 'config-line', 'config-vlan'];

export class Network {
  readonly devices = new Map<string, Device>();
  readonly topology: TopologySpec;

  constructor(topology: TopologySpec) {
    this.topology = topology;
    for (const spec of topology.devices) this.devices.set(spec.id, new Device(spec));
    for (const [id, lines] of Object.entries(topology.setup ?? {})) {
      for (const line of lines) this.exec(id, line);
      const dev = this.devices.get(id);
      if (dev) dev.session = Device.freshSession();
    }
  }

  /** Builds a network and replays a student's command log onto it. */
  static replay(topology: TopologySpec, log: LogEntry[]): Network {
    const net = new Network(topology);
    for (const entry of log) net.exec(entry.device, entry.line);
    return net;
  }

  device(id: string): Device {
    const dev = this.devices.get(id);
    if (!dev) throw new Error(`Unknown device ${id}`);
    return dev;
  }

  /** The device and port at the other end of a cable. */
  peer(deviceId: string, port: string): LinkEnd | undefined {
    for (const l of this.topology.links) {
      if (l.a.device === deviceId && l.a.port === port) return l.b;
      if (l.b.device === deviceId && l.b.port === port) return l.a;
    }
    return undefined;
  }

  /** Physical link is up: cable present and neither end shut down. */
  linkUp(deviceId: string, port: string): boolean {
    const dev = this.devices.get(deviceId);
    const cfg = dev?.iface(port);
    const p = this.peer(deviceId, port);
    if (!cfg || cfg.shutdown || !p) return false;
    const other = this.devices.get(p.device)?.iface(p.port);
    return !!other && !other.shutdown;
  }

  /** Interface (or subinterface) is up/up. */
  ifaceUp(deviceId: string, name: string): boolean {
    const parent = parentInterface(name);
    if (parent !== name) {
      const sub = this.devices.get(deviceId)?.iface(name);
      return !!sub && !sub.shutdown && this.linkUp(deviceId, parent);
    }
    return this.linkUp(deviceId, name);
  }

  ping(from: string, toIp: string): PingResult {
    return ping(this, from, toIp);
  }

  // ---- Terminal API -------------------------------------------------------

  prompt(deviceId: string): string {
    const dev = this.device(deviceId);
    const p = dev.session.pending;
    if (p) {
      if (p.kind === 'enable' || p.kind === 'login') return 'Password: ';
      if (p.kind === 'copy') return 'Destination filename [startup-config]? ';
      if (p.kind === 'reload') return 'Proceed with reload? [confirm]';
      return '';
    }
    if (dev.kind === 'pc') return PC_PROMPT;
    const host = dev.running.hostname;
    switch (dev.session.mode) {
      case 'user':
        return `${host}>`;
      case 'priv':
        return `${host}#`;
      default:
        return `${host}(${dev.session.mode})#`;
    }
  }

  /** True while the terminal should not echo what's typed (passwords). */
  isSecretInput(deviceId: string): boolean {
    const k = this.device(deviceId).session.pending?.kind;
    return k === 'enable' || k === 'login';
  }

  /** Runs one line typed at a device's terminal and returns the output text. */
  exec(deviceId: string, line: string): string {
    const dev = this.devices.get(deviceId);
    if (!dev) return '';
    line = line.slice(0, 300);
    if (dev.session.pending) return this.handlePending(dev, line);
    if (line.trim() === '') return '';
    const tree = this.treeFor(dev);
    let r: MatchResult<Ctx> = match(tree, line);
    // Like IOS, a command that isn't valid in a sub-mode is tried in global config.
    if (!r.ok && CONFIG_SUBMODES.includes(dev.session.mode)) {
      const r2 = match(this.trees(dev).config, line);
      if (r2.ok) r = r2;
    }
    if (!r.ok) return this.errorText(dev, r, line);
    return r.handler({ net: this, dev }, r.args) ?? '';
  }

  /** Runs an exec-mode command from config mode (`do show vlan brief`). */
  execDo(dev: Device, line: string): string {
    const r = match(this.trees(dev).priv, line);
    if (!r.ok) return this.errorText(dev, r, line, 'do '.length);
    const saved = dev.session.mode;
    const out = r.handler({ net: this, dev }, r.args) ?? '';
    // `do` never changes the mode, except for prompts like copy confirmation.
    dev.session.mode = saved;
    return out;
  }

  help(deviceId: string, line: string): string {
    const dev = this.device(deviceId);
    if (dev.session.pending) return '';
    return help(this.treeFor(dev), line);
  }

  complete(deviceId: string, line: string): string | null {
    const dev = this.device(deviceId);
    if (dev.session.pending) return null;
    return complete(this.treeFor(dev), line) ?? complete(this.trees(dev).config, line);
  }

  // ---- internals ----------------------------------------------------------

  trees(dev: Device): IosTrees {
    return iosTrees(dev.kind);
  }

  private treeFor(dev: Device): CommandTree<Ctx> {
    if (dev.kind === 'pc') return pcTree;
    const t = this.trees(dev);
    switch (dev.session.mode) {
      case 'user':
        return t.user;
      case 'priv':
        return t.priv;
      case 'config':
        return t.config;
      case 'config-if':
      case 'config-if-range':
      case 'config-subif':
        return t.iface;
      case 'config-line':
        return t.line;
      case 'config-vlan':
        return t.vlan;
    }
  }

  private errorText(dev: Device, r: MatchResult<Ctx>, line: string, offset = 0): string {
    if (r.ok || r.error === 'empty') return '';
    if (dev.kind === 'pc') return 'Invalid Command.';
    if (r.error === 'ambiguous') return `% Ambiguous command:  "${r.input}"`;
    if (r.error === 'incomplete') return '% Incomplete command.';
    const execMode = dev.session.mode === 'user' || dev.session.mode === 'priv';
    const words = line.trim().split(/\s+/);
    if (execMode && r.tokenIndex === 0 && words.length === 1 && offset === 0) {
      return `Translating "${words[0]}"...domain server (255.255.255.255)\n% Unknown command or computer name, or unable to find computer address`;
    }
    const caret = ' '.repeat(this.prompt(dev.id).length + offset + r.pos) + '^';
    return `${caret}\n% Invalid input detected at '^' marker.`;
  }

  private handlePending(dev: Device, line: string): string {
    const s = dev.session;
    const p = s.pending!;
    const cfg = dev.running;
    switch (p.kind) {
      case 'enable': {
        const ok = cfg.enableSecret !== undefined ? line === cfg.enableSecret : line === cfg.enablePassword;
        if (ok) {
          s.pending = null;
          s.mode = 'priv';
          return '';
        }
        p.tries++;
        if (p.tries >= 3) {
          s.pending = null;
          return '% Bad secrets\n';
        }
        return '';
      }
      case 'press-return': {
        s.pending = null;
        let out = cfg.bannerMotd ? `${cfg.bannerMotd}\n` : '';
        if (cfg.con.login) {
          if (!cfg.con.password) {
            out += '\nPassword required, but none set\n';
            return out + this.logout(dev);
          }
          s.pending = { kind: 'login', tries: 0 };
          return out + '\nUser Access Verification\n';
        }
        s.mode = 'user';
        return out;
      }
      case 'login': {
        if (line === cfg.con.password) {
          s.pending = null;
          s.mode = 'user';
          return '';
        }
        p.tries++;
        if (p.tries >= 3) return '% Bad passwords\n' + this.logout(dev);
        return '% Login invalid\n';
      }
      case 'copy': {
        s.pending = null;
        dev.startup = clone(dev.running);
        return 'Building configuration...\n[OK]';
      }
      case 'reload': {
        s.pending = null;
        if (/^\s*n/i.test(line)) return '';
        dev.running = dev.startup ? clone(dev.startup) : defaultConfig(dev.spec);
        dev.session = Device.freshSession();
        return '\nSystem Bootstrap, restarting...\n' + this.logout(dev);
      }
    }
  }

  /** Ends the exec session; the next Enter starts a new one (banner, login). */
  logout(dev: Device): string {
    dev.session = Device.freshSession();
    dev.session.pending = { kind: 'press-return' };
    return `\n${dev.running.hostname} con0 is now available\n\n\n\n\n\nPress RETURN to get started.\n`;
  }
}
