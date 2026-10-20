import { clone, parseVlanList } from './config.ts';
import { expandRange, formatInterface, parentInterface, parseInterfaceName } from './interfaces.ts';
import type { Ctx, Mode } from './network.ts';
import { CommandTree, ipToInt } from './parser.ts';
import { routerPingOutput } from './ping.ts';
import {
  showInterfacesStatus,
  showInterfacesTrunk,
  showIpInterfaceBrief,
  showMacAddressTable,
  showRunningConfig,
  showStartupConfig,
  showVersion,
  showVlanBrief,
} from './show.ts';
import type { DeviceKind, InterfaceConfig } from './types.ts';

export interface IosTrees {
  user: CommandTree<Ctx>;
  priv: CommandTree<Ctx>;
  config: CommandTree<Ctx>;
  iface: CommandTree<Ctx>;
  line: CommandTree<Ctx>;
  vlan: CommandTree<Ctx>;
}

const H: Record<string, string> = {
  enable: 'Turn on privileged commands',
  disable: 'Turn off privileged commands',
  exit: 'Exit from the EXEC',
  logout: 'Exit from the EXEC',
  ping: 'Send echo messages',
  show: 'Show running system information',
  configure: 'Enter configuration mode',
  terminal: 'Configure from the terminal',
  copy: 'Copy from one file to another',
  'running-config': 'Current operating configuration',
  'startup-config': 'Contents of startup configuration',
  write: 'Write running configuration to memory, network, or terminal',
  memory: 'Write to NV memory',
  reload: 'Halt and perform a cold restart',
  vlan: 'VTP VLAN status',
  brief: 'VTP all VLAN status in brief',
  interfaces: 'Interface status and configuration',
  status: 'Show interface line status',
  trunk: 'Show interface trunk information',
  ip: 'IP information',
  interface: 'IP interface status and configuration',
  'mac-address-table': 'MAC forwarding table',
  'mac': 'MAC configuration',
  'address-table': 'MAC forwarding table',
  version: 'System hardware and software status',
  hostname: 'Set system\'s network name',
  secret: 'Assign the privileged level secret',
  password: 'Assign the privileged level password',
  service: 'Modify use of network based services',
  'password-encryption': 'Encrypt system passwords',
  banner: 'Define a login banner',
  motd: 'Set Message of the Day banner',
  line: 'Configure a terminal line',
  console: 'Primary terminal line',
  vty: 'Virtual terminal',
  range: 'interface range command',
  end: 'Exit from configure mode',
  do: 'To run exec commands in config mode',
  no: 'Negate a command or set its defaults',
  description: 'Interface specific description',
  shutdown: 'Shutdown the selected interface',
  switchport: 'Set switching mode characteristics',
  mode: 'Set trunking mode of the interface',
  access: 'Set access mode characteristics of the interface',
  allowed: 'Set allowed VLAN characteristics when interface is in trunking mode',
  add: 'add VLANs to the current list',
  remove: 'remove VLANs from the current list',
  all: 'all VLANs',
  none: 'no VLANs',
  except: 'all VLANs except the following',
  address: 'Set the IP address of an interface',
  encapsulation: 'Set encapsulation type for an interface',
  dot1q: 'IEEE 802.1Q Virtual LAN',
  login: 'Enable password checking',
  name: 'Ascii name of the VLAN',
  text: 'c message-text c, where \'c\' is a delimiting character',
  word: 'The UNENCRYPTED (cleartext) password',
};

const SYS_CONFIGURED = '%SYS-5-CONFIG_I: Configured from console by console';

function setMode(ctx: Ctx, mode: Mode): void {
  ctx.dev.session.mode = mode;
}

function exitTo(ctx: Ctx, mode: Mode): string {
  const s = ctx.dev.session;
  s.ifaces = [];
  s.lines = null;
  s.vlans = [];
  setMode(ctx, mode);
  return mode === 'priv' ? SYS_CONFIGURED : '';
}

function selectedIfaces(ctx: Ctx): InterfaceConfig[] {
  return ctx.dev.session.ifaces
    .map((n) => ctx.dev.iface(n))
    .filter((i): i is InterfaceConfig => i !== undefined);
}

function network(ip: string, mask: string): number {
  return (ipToInt(ip) & ipToInt(mask)) >>> 0;
}

function prefixLength(mask: string): number {
  return ipToInt(mask).toString(2).replace(/0/g, '').length;
}

// ---- exec ------------------------------------------------------------------

function addShows(t: CommandTree<Ctx>, kind: DeviceKind, privileged: boolean): void {
  if (privileged) {
    t.add('show running-config', H, ({ net, dev }) => showRunningConfig(net, dev));
    t.add('show startup-config', H, ({ net, dev }) => showStartupConfig(net, dev));
  }
  t.add('show ip interface brief', H, ({ net, dev }) => showIpInterfaceBrief(net, dev));
  t.add('show version', H, ({ dev }) => showVersion(dev));
  if (kind === 'switch') {
    t.add('show vlan', H, ({ dev }) => showVlanBrief(dev));
    t.add('show vlan brief', H, ({ dev }) => showVlanBrief(dev));
    t.add('show interfaces status', H, ({ net, dev }) => showInterfacesStatus(net, dev));
    t.add('show interfaces trunk', H, ({ net, dev }) => showInterfacesTrunk(net, dev));
    t.add('show mac address-table', H, ({ net, dev }) => showMacAddressTable(net, dev));
    t.add('show mac-address-table', H, ({ net, dev }) => showMacAddressTable(net, dev));
  }
}

function addExecCommon(t: CommandTree<Ctx>): void {
  const logout = ({ net, dev }: Ctx) => net.logout(dev);
  t.add('exit', H, logout);
  t.add('logout', H, logout);
  t.add('ping <target:ip>', { target: 'Ping destination address' }, ({ net, dev }, a) =>
    routerPingOutput(net, dev.id, a.target!),
  );
}

function buildUser(kind: DeviceKind): CommandTree<Ctx> {
  const t = new CommandTree<Ctx>(H);
  t.add('enable', H, (ctx) => {
    const cfg = ctx.dev.running;
    if (cfg.enableSecret !== undefined || cfg.enablePassword !== undefined) {
      ctx.dev.session.pending = { kind: 'enable', tries: 0 };
      return '';
    }
    setMode(ctx, 'priv');
  });
  addExecCommon(t);
  addShows(t, kind, false);
  return t;
}

function buildPriv(kind: DeviceKind): CommandTree<Ctx> {
  const t = new CommandTree<Ctx>(H);
  t.add('enable', H, () => '');
  t.add('disable', H, (ctx) => setMode(ctx, 'user'));
  t.add('configure terminal', H, (ctx) => {
    setMode(ctx, 'config');
    return 'Enter configuration commands, one per line.  End with CNTL/Z.';
  });
  t.add('copy running-config startup-config', H, (ctx) => {
    ctx.dev.session.pending = { kind: 'copy' };
  });
  const save = ({ dev }: Ctx) => {
    dev.startup = clone(dev.running);
    return 'Building configuration...\n[OK]';
  };
  t.add('write', H, save);
  t.add('write memory', H, save);
  t.add('reload', H, (ctx) => {
    ctx.dev.session.pending = { kind: 'reload' };
  });
  addExecCommon(t);
  addShows(t, kind, true);
  return t;
}

// ---- global config ---------------------------------------------------------

function addModeExits(t: CommandTree<Ctx>, exitMode: Mode): void {
  t.add('exit', H, (ctx) => exitTo(ctx, exitMode));
  t.add('end', H, (ctx) => exitTo(ctx, 'priv'));
  t.add('do <command:rest>', { command: 'Exec command' }, ({ net, dev }, a) => net.execDo(dev, a.command!));
}

function buildConfig(kind: DeviceKind): CommandTree<Ctx> {
  const t = new CommandTree<Ctx>(H);
  addModeExits(t, 'priv');

  t.add('hostname <name:word>', { name: 'This system\'s network name' }, ({ dev }, a) => {
    if (!/^[a-z][\w-]*$/i.test(a.name!)) return '% Hostname contains one or more illegal characters.';
    dev.running.hostname = a.name!.slice(0, 63);
  });
  t.add('no hostname', H, ({ dev }) => {
    dev.running.hostname = kind === 'switch' ? 'Switch' : 'Router';
  });

  t.add('enable secret <secret:word>', H, ({ dev }, a) => {
    dev.running.enableSecret = a.secret!;
  });
  t.add('enable password <secret:word>', H, ({ dev }, a) => {
    dev.running.enablePassword = a.secret!;
  });
  t.add('no enable secret', H, ({ dev }) => {
    delete dev.running.enableSecret;
  });
  t.add('no enable password', H, ({ dev }) => {
    delete dev.running.enablePassword;
  });

  t.add('service password-encryption', H, ({ dev }) => {
    dev.running.servicePasswordEncryption = true;
  });
  t.add('no service password-encryption', H, ({ dev }) => {
    dev.running.servicePasswordEncryption = false;
  });

  t.add('banner motd <text:rest>', H, ({ dev }, a) => {
    const raw = a.text!;
    const delim = raw[0]!;
    const end = raw.indexOf(delim, 1);
    if (end === -1) {
      return `% Type the whole banner on one line, starting and ending with the same character, e.g. banner motd #Authorized access only#`;
    }
    dev.running.bannerMotd = raw.slice(1, end);
  });
  t.add('no banner motd', H, ({ dev }) => {
    delete dev.running.bannerMotd;
  });

  t.add('line console <first:line>', { first: 'First Line number' }, (ctx, a) => {
    if (a.first !== '0') return '% Invalid input detected: only line console 0 exists.';
    ctx.dev.session.lines = { kind: 'con', from: 0, to: 0 };
    setMode(ctx, 'config-line');
  });
  const vty = (ctx: Ctx, a: Record<string, string>) => {
    const from = Number(a.first);
    const to = a.last === undefined ? from : Number(a.last);
    if (to < from) return '%Invalid line range';
    ctx.dev.session.lines = { kind: 'vty', from, to };
    setMode(ctx, 'config-line');
  };
  t.add('line vty <first:line>', H, vty);
  t.add('line vty <first:line> <last:line>', { last: 'Last Line number' }, vty);

  t.add('interface <name:iface>', H, (ctx, a) => selectInterface(ctx, a.name!));
  t.add('interface range <list:range>', H, (ctx, a) => {
    const names = expandRange(a.list!);
    if (!names || names.some((n) => !ctx.dev.iface(n) || n.includes('.'))) {
      return '%Invalid interface type and number';
    }
    ctx.dev.session.ifaces = names;
    setMode(ctx, 'config-if-range');
  });

  if (kind === 'switch') {
    t.add('vlan <ids:vlanlist>', { ids: 'ISL VLAN IDs 1-1005' }, (ctx, a) => {
      const ids = parseVlanList(a.ids!)!;
      for (const id of ids) {
        const key = String(id);
        if (!ctx.dev.running.vlans[key]) {
          ctx.dev.running.vlans[key] = { name: `VLAN${key.padStart(4, '0')}` };
        }
      }
      ctx.dev.session.vlans = ids;
      setMode(ctx, 'config-vlan');
    });
    t.add('no vlan <ids:vlanlist>', { ids: 'ISL VLAN IDs 1-1005' }, ({ dev }, a) => {
      const out: string[] = [];
      for (const id of parseVlanList(a.ids!)!) {
        if (id === 1 || (id >= 1002 && id <= 1005)) {
          out.push(`%Default VLAN ${id} may not be deleted.`);
        } else {
          delete dev.running.vlans[String(id)];
        }
      }
      return out.join('\n');
    });
  }
  return t;
}

function selectInterface(ctx: Ctx, input: string): string | void {
  const p = parseInterfaceName(input);
  const dev = ctx.dev;
  if (!p) return '%Invalid interface type and number';
  const name = formatInterface(p);
  if (p.type === 'Vlan') return '% VLAN interfaces (SVIs) are not available in this lab yet.';
  if (p.sub !== undefined) {
    if (dev.kind !== 'router') return '%Invalid interface type and number';
    if (!dev.iface(parentInterface(name))) return '%Invalid interface type and number';
    if (!dev.iface(name)) dev.running.interfaces[name] = { name, shutdown: false };
    dev.session.ifaces = [name];
    setMode(ctx, 'config-subif');
    return;
  }
  if (!dev.iface(name)) return '%Invalid interface type and number';
  dev.session.ifaces = [name];
  setMode(ctx, 'config-if');
}

// ---- interface config --------------------------------------------------------

function stateMessages(ctx: Ctx, before: Map<string, boolean>, admin: 'down' | 'up'): string {
  const out: string[] = [];
  for (const i of selectedIfaces(ctx)) {
    const was = before.get(i.name)!;
    const now = ctx.net.ifaceUp(ctx.dev.id, i.name);
    if (admin === 'down') {
      out.push(`%LINK-5-CHANGED: Interface ${i.name}, changed state to administratively down`);
      if (was) out.push(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${i.name}, changed state to down`);
    } else if (!was) {
      const linkUp = i.name.includes('.') ? now : ctx.net.peer(ctx.dev.id, i.name) !== undefined;
      out.push(
        linkUp
          ? `%LINK-5-CHANGED: Interface ${i.name}, changed state to up`
          : `%LINK-5-CHANGED: Interface ${i.name}, changed state to down`,
      );
      if (now) out.push(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${i.name}, changed state to up`);
    }
  }
  return out.join('\n');
}

function setShutdown(ctx: Ctx, shutdown: boolean): string {
  const before = new Map(selectedIfaces(ctx).map((i) => [i.name, ctx.net.ifaceUp(ctx.dev.id, i.name)]));
  const changed = selectedIfaces(ctx).filter((i) => i.shutdown !== shutdown);
  for (const i of selectedIfaces(ctx)) i.shutdown = shutdown;
  if (changed.length === 0) return '';
  const saved = ctx.dev.session.ifaces;
  ctx.dev.session.ifaces = changed.map((i) => i.name);
  const out = stateMessages(ctx, before, shutdown ? 'down' : 'up');
  ctx.dev.session.ifaces = saved;
  return out;
}

function buildIface(kind: DeviceKind): CommandTree<Ctx> {
  const t = new CommandTree<Ctx>(H);
  addModeExits(t, 'config');
  t.add('description <text:rest>', { text: 'Up to 240 characters describing this interface' }, (ctx, a) => {
    for (const i of selectedIfaces(ctx)) i.description = a.text!.slice(0, 240);
  });
  t.add('no description', H, (ctx) => {
    for (const i of selectedIfaces(ctx)) delete i.description;
  });
  t.add('shutdown', H, (ctx) => setShutdown(ctx, true));
  t.add('no shutdown', H, (ctx) => setShutdown(ctx, false));

  if (kind === 'switch') {
    const setMode2 = (mode: 'access' | 'trunk') => (ctx: Ctx) => {
      for (const i of selectedIfaces(ctx)) {
        i.mode = mode;
        i.modeConfigured = true;
      }
    };
    t.add('switchport mode access', { access: 'Set trunking mode to ACCESS unconditionally' }, setMode2('access'));
    t.add('switchport mode trunk', { trunk: 'Set trunking mode to TRUNK unconditionally' }, setMode2('trunk'));
    t.add('switchport access vlan <id:vlan>', { vlan: 'Set VLAN when interface is in access mode' }, (ctx, a) => {
      const id = a.id!;
      let out = '';
      if (!ctx.dev.running.vlans[id]) {
        ctx.dev.running.vlans[id] = { name: `VLAN${id.padStart(4, '0')}` };
        out = `% Access VLAN does not exist. Creating vlan ${id}`;
      }
      for (const i of selectedIfaces(ctx)) i.accessVlan = Number(id);
      return out;
    });
    t.add('no switchport access vlan', H, (ctx) => {
      for (const i of selectedIfaces(ctx)) i.accessVlan = 1;
    });
    const allowed = (fn: (current: number[] | 'all', list: number[]) => number[] | 'all') =>
      (ctx: Ctx, a: Record<string, string>) => {
        const list = a.list === undefined ? [] : parseVlanList(a.list)!;
        for (const i of selectedIfaces(ctx)) i.trunkAllowed = fn(i.trunkAllowed ?? 'all', list);
      };
    const all = Array.from({ length: 4094 }, (_, k) => k + 1);
    t.add('switchport trunk allowed vlan <list:vlanlist>', H, allowed((_c, l) => l));
    t.add('switchport trunk allowed vlan add <list:vlanlist>', H,
      allowed((c, l) => (c === 'all' ? 'all' : [...new Set([...c, ...l])].sort((x, y) => x - y))));
    t.add('switchport trunk allowed vlan remove <list:vlanlist>', H,
      allowed((c, l) => (c === 'all' ? all : c).filter((v) => !l.includes(v))));
    t.add('switchport trunk allowed vlan except <list:vlanlist>', H, allowed((_c, l) => all.filter((v) => !l.includes(v))));
    t.add('switchport trunk allowed vlan all', H, allowed(() => 'all'));
    t.add('switchport trunk allowed vlan none', H, allowed(() => []));
    t.add('no switchport trunk allowed vlan', H, allowed(() => 'all'));
  } else {
    t.add('ip address <address:ip> <mask:mask>', H, (ctx, a) => setIp(ctx, a.address!, a.mask!));
    t.add('no ip address', H, (ctx) => {
      for (const i of selectedIfaces(ctx)) delete i.ip;
    });
    t.add('encapsulation dot1q <vlan:vlan>', { vlan: 'IEEE 802.1Q VLAN ID required' }, (ctx, a) => {
      const vlan = Number(a.vlan);
      const [i] = selectedIfaces(ctx);
      if (!i || !i.name.includes('.')) {
        return '% Encapsulation dot1Q is configured on a subinterface, e.g. interface g0/0.10';
      }
      const parent = parentInterface(i.name);
      const clash = Object.values(ctx.dev.running.interfaces).find(
        (o) => o !== i && parentInterface(o.name) === parent && o.encapsulationVlan === vlan,
      );
      if (clash) {
        return `%Configuration of multiple subinterfaces of the same main interface with the same VID (${vlan}) is not permitted.\nThis VID is already configured on ${clash.name}.`;
      }
      i.encapsulationVlan = vlan;
    });
  }
  return t;
}

function setIp(ctx: Ctx, address: string, mask: string): string | void {
  const [i] = selectedIfaces(ctx);
  if (!i) return;
  if (i.name.includes('.') && i.encapsulationVlan === undefined) {
    return '% Configuring IP routing on a LAN subinterface is only allowed if that\nsubinterface is already configured as part of an IEEE 802.10, IEEE 802.1Q,\nor ISL vLAN.';
  }
  const len = prefixLength(mask);
  const host = ipToInt(address) & ~ipToInt(mask);
  const hostMax = ~ipToInt(mask) >>> 0;
  if (len < 31 && (host === 0 || host >>> 0 === hostMax)) return `Bad mask /${len} for address ${address}`;
  const net = network(address, mask);
  for (const o of Object.values(ctx.dev.running.interfaces)) {
    if (o === i || !o.ip) continue;
    if (network(o.ip.address, o.ip.mask) === network(address, o.ip.mask) || network(o.ip.address, mask) === net) {
      return `% ${netString(net)} overlaps with ${o.name}`;
    }
  }
  i.ip = { address, mask };
}

function netString(n: number): string {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
}

// ---- line & vlan config ------------------------------------------------------

function selectedLines(ctx: Ctx) {
  const sel = ctx.dev.session.lines;
  if (!sel) return [];
  if (sel.kind === 'con') return [ctx.dev.running.con];
  return ctx.dev.running.vty.slice(sel.from, sel.to + 1);
}

function buildLine(): CommandTree<Ctx> {
  const t = new CommandTree<Ctx>(H);
  addModeExits(t, 'config');
  t.add('password <pw:word>', { pw: 'The UNENCRYPTED (cleartext) line password' }, (ctx, a) => {
    for (const l of selectedLines(ctx)) l.password = a.pw!;
  });
  t.add('no password', H, (ctx) => {
    for (const l of selectedLines(ctx)) delete l.password;
  });
  t.add('login', H, (ctx) => {
    for (const l of selectedLines(ctx)) l.login = true;
  });
  t.add('no login', H, (ctx) => {
    for (const l of selectedLines(ctx)) l.login = false;
  });
  return t;
}

function buildVlan(): CommandTree<Ctx> {
  const t = new CommandTree<Ctx>(H);
  addModeExits(t, 'config');
  t.add('name <name:word>', { name: 'The ascii name for the VLAN' }, (ctx, a) => {
    const out: string[] = [];
    for (const id of ctx.dev.session.vlans) {
      if (id === 1 || (id >= 1002 && id <= 1005)) {
        out.push(`%Default VLAN ${id} may not have its name changed.`);
        continue;
      }
      ctx.dev.running.vlans[String(id)] = { name: a.name!.slice(0, 32) };
    }
    return out.join('\n');
  });
  return t;
}

const cache = new Map<DeviceKind, IosTrees>();

export function iosTrees(kind: DeviceKind): IosTrees {
  let t = cache.get(kind);
  if (!t) {
    t = {
      user: buildUser(kind),
      priv: buildPriv(kind),
      config: buildConfig(kind),
      iface: buildIface(kind),
      line: buildLine(),
      vlan: buildVlan(),
    };
    cache.set(kind, t);
  }
  return t;
}

