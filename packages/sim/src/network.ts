import { clone, defaultConfig } from './config.ts';
import { hasIos, ID_BASE, KINDS, modelInfo, portsOf } from './catalog.ts';
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
  /** `terminal length`: lines per screen before --More--, 0 = no paging. */
  termLength: number;
}

export const LIMITS = { devices: 24, links: 48 };

export interface NetworkSnapshot {
  version: 1;
  topology: TopologySpec;
  configs: Record<string, { running: DeviceConfig; startup: DeviceConfig | null }>;
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
  /** ARP cache of an end device: IP -> MAC. Runtime state, not saved. */
  readonly arp = new Map<string, string>();

  constructor(spec: DeviceSpec) {
    this.id = spec.id;
    this.kind = spec.kind;
    this.spec = spec;
    this.running = defaultConfig(spec);
    this.session = Device.freshSession();
  }

  static freshSession(): Session {
    return { mode: 'user', ifaces: [], lines: null, vlans: [], pending: null, termLength: 24 };
  }

  get model(): string {
    return modelInfo(this.spec).model;
  }

  get ports(): string[] {
    return portsOf(this.spec);
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
    // Own copy: the sandbox edits devices and links in place.
    this.topology = clone(topology);
    for (const spec of this.topology.devices) this.devices.set(spec.id, new Device(spec));
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

  // ---- Editing (sandbox) --------------------------------------------------

  /** Next free Packet Tracer-style id for a kind: Switch0, Router1, PC2... */
  nextId(kind: DeviceKind): string {
    const base = ID_BASE[kind];
    let n = 0;
    while (this.devices.has(`${base}${n}`)) n++;
    return `${base}${n}`;
  }

  addDevice(kind: DeviceKind, x: number, y: number, model?: string): Device {
    if (this.devices.size >= LIMITS.devices) throw new Error(`A topology can have at most ${LIMITS.devices} devices.`);
    if (!KINDS.includes(kind)) throw new Error('Unknown device type.');
    const spec: DeviceSpec = { id: this.nextId(kind), kind, x, y, model: modelInfo({ kind, model }).model };
    this.topology.devices.push(spec);
    const dev = new Device(spec);
    this.devices.set(spec.id, dev);
    return dev;
  }

  removeDevice(id: string): void {
    this.topology.links = this.topology.links.filter((l) => l.a.device !== id && l.b.device !== id);
    this.topology.devices = this.topology.devices.filter((d) => d.id !== id);
    this.devices.delete(id);
  }

  moveDevice(id: string, x: number, y: number): void {
    const spec = this.topology.devices.find((d) => d.id === id);
    if (spec) {
      spec.x = x;
      spec.y = y;
    }
  }

  /** Ports with no cable plugged in. */
  freePorts(deviceId: string): string[] {
    const dev = this.devices.get(deviceId);
    if (!dev) return [];
    return dev.ports.filter((p) => !this.peer(deviceId, p));
  }

  /** Plugs in a cable. Returns an error message, or null on success. */
  connect(a: LinkEnd, b: LinkEnd): string | null {
    if (a.device === b.device) return 'A cable needs two different devices.';
    for (const end of [a, b]) {
      const dev = this.devices.get(end.device);
      if (!dev || !dev.ports.includes(end.port)) return `${end.device} has no port ${end.port}.`;
      if (this.peer(end.device, end.port)) return `${end.device} ${end.port} already has a cable.`;
    }
    if (this.topology.links.length >= LIMITS.links) return `A topology can have at most ${LIMITS.links} cables.`;
    this.topology.links.push({ a, b });
    return null;
  }

  disconnect(deviceId: string, port: string): void {
    this.topology.links = this.topology.links.filter(
      (l) => !(l.a.device === deviceId && l.a.port === port) && !(l.b.device === deviceId && l.b.port === port),
    );
  }

  /** Everything needed to rebuild this network later: layout, cables and every config. */
  snapshot(): NetworkSnapshot {
    const configs: NetworkSnapshot['configs'] = {};
    for (const dev of this.devices.values()) configs[dev.id] = { running: dev.running, startup: dev.startup };
    return clone({ version: 1, topology: { devices: this.topology.devices, links: this.topology.links }, configs });
  }

  /** Rebuilds a network from a snapshot. Throws if the snapshot is malformed. */
  static fromSnapshot(s: NetworkSnapshot): Network {
    const t = s?.topology;
    if (s?.version !== 1 || !Array.isArray(t?.devices) || !Array.isArray(t?.links)) throw new Error('Not a NetLab topology.');
    if (t.devices.length > LIMITS.devices || t.links.length > LIMITS.links) throw new Error('Topology is too big.');
    const ids = new Set<string>();
    for (const d of t.devices) {
      if (!/^[A-Za-z0-9_-]{1,20}$/.test(d.id) || ids.has(d.id)) throw new Error('Bad device id.');
      if (!KINDS.includes(d.kind)) throw new Error('Bad device kind.');
      if (d.model !== undefined && modelInfo(d).model !== d.model) throw new Error('Bad device model.');
      if (typeof d.x !== 'number' || typeof d.y !== 'number') throw new Error('Bad device position.');
      ids.add(d.id);
    }
    const net = new Network({ devices: t.devices, links: [] });
    for (const l of t.links) {
      const err = net.connect(l.a, l.b);
      if (err) throw new Error(err);
    }
    for (const [id, c] of Object.entries(s.configs ?? {})) {
      const dev = net.devices.get(id);
      if (!dev || !c?.running?.interfaces) continue;
      dev.running = clone(c.running);
      dev.startup = c.startup ? clone(c.startup) : null;
    }
    return net;
  }

  /** Lines per page before `--More--`; 0 means never pause (`terminal length 0`). */
  pageLength(deviceId: string): number {
    const dev = this.devices.get(deviceId);
    return !dev || !hasIos(dev.kind) ? 0 : dev.session.termLength;
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
    if (!hasIos(dev.kind)) return PC_PROMPT;
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
    if (!dev || dev.kind === 'hub') return '';
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
    const done = complete(this.treeFor(dev), line);
    return done ?? (hasIos(dev.kind) ? complete(this.trees(dev).config, line) : null);
  }

  // ---- internals ----------------------------------------------------------

  trees(dev: Device): IosTrees {
    return iosTrees(dev.kind);
  }

  private treeFor(dev: Device): CommandTree<Ctx> {
    if (!hasIos(dev.kind)) return pcTree;
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
    if (!hasIos(dev.kind)) return 'Invalid Command.';
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
