import { formatVlanList, vlanAllowed } from './config.ts';
import { type7, type5Display } from './crypto.ts';
import { parentInterface, physicalPorts, shortName } from './interfaces.ts';
import type { Device, Network } from './network.ts';
import type { DeviceConfig, InterfaceConfig, LineConfig } from './types.ts';

function pw(cfg: DeviceConfig, plain: string): string {
  return cfg.servicePasswordEncryption ? `7 ${type7(plain)}` : plain;
}

/** Physical interfaces in hardware order, each followed by its subinterfaces. */
function orderedInterfaces(dev: Device, cfg: DeviceConfig): InterfaceConfig[] {
  const out: InterfaceConfig[] = [];
  for (const name of physicalPorts(dev.kind)) {
    const i = cfg.interfaces[name];
    if (i) out.push(i);
    const subs = Object.values(cfg.interfaces)
      .filter((s) => s.name !== name && parentInterface(s.name) === name)
      .sort((a, b) => Number(a.name.split('.')[1]) - Number(b.name.split('.')[1]));
    out.push(...subs);
  }
  return out;
}

function lineBlock(cfg: DeviceConfig, label: string, l: LineConfig): string[] {
  const out = [label];
  if (l.password) out.push(` password ${pw(cfg, l.password)}`);
  if (l.login) out.push(' login');
  return out;
}

function vtyBlocks(cfg: DeviceConfig): string[] {
  const out: string[] = [];
  for (const [lo, hi] of [
    [0, 4],
    [5, 15],
  ] as const) {
    let start: number = lo;
    for (let i = lo + 1; i <= hi + 1; i++) {
      const same = i <= hi && JSON.stringify(cfg.vty[i]) === JSON.stringify(cfg.vty[start]);
      if (!same) {
        const end = i - 1;
        out.push(...lineBlock(cfg, `line vty ${start}${end === start ? '' : ` ${end}`}`, cfg.vty[start]!));
        start = i;
      }
    }
  }
  return out;
}

function configBody(dev: Device, cfg: DeviceConfig): string {
  const L: string[] = ['!'];
  L.push(dev.kind === 'switch' ? 'version 15.0' : 'version 15.1');
  L.push('no service timestamps log datetime msec', 'no service timestamps debug datetime msec');
  L.push(cfg.servicePasswordEncryption ? 'service password-encryption' : 'no service password-encryption');
  L.push('!', `hostname ${cfg.hostname}`, '!');
  if (cfg.enableSecret !== undefined) L.push(`enable secret 5 ${type5Display(cfg.enableSecret)}`);
  if (cfg.enablePassword !== undefined) L.push(`enable password ${pw(cfg, cfg.enablePassword)}`);
  L.push('!', '!');
  if (dev.kind === 'switch') L.push('spanning-tree mode pvst', 'spanning-tree extend system-id', '!');

  for (const i of orderedInterfaces(dev, cfg)) {
    L.push(`interface ${i.name}`);
    if (i.description) L.push(` description ${i.description}`);
    if (dev.kind === 'switch') {
      if ((i.accessVlan ?? 1) !== 1) L.push(` switchport access vlan ${i.accessVlan}`);
      if (Array.isArray(i.trunkAllowed)) {
        L.push(` switchport trunk allowed vlan ${i.trunkAllowed.length ? formatVlanList(i.trunkAllowed) : 'none'}`);
      }
      if (i.modeConfigured) L.push(` switchport mode ${i.mode}`);
    } else {
      if (i.encapsulationVlan !== undefined) L.push(` encapsulation dot1Q ${i.encapsulationVlan}`);
      L.push(i.ip ? ` ip address ${i.ip.address} ${i.ip.mask}` : ' no ip address');
      if (!i.name.includes('.')) L.push(' duplex auto', ' speed auto');
    }
    if (i.shutdown) L.push(' shutdown');
    L.push('!');
  }
  if (dev.kind === 'switch') L.push('interface Vlan1', ' no ip address', ' shutdown', '!');
  if (dev.kind === 'router') L.push('ip classless', '!', 'ip flow-export version 9', '!');
  if (cfg.bannerMotd !== undefined) L.push(`banner motd ^C${cfg.bannerMotd}^C`, '!');
  L.push(...lineBlock(cfg, 'line con 0', cfg.con), '!');
  if (dev.kind === 'router') L.push('line aux 0', '!');
  L.push(...vtyBlocks(cfg), '!', '!', 'end');
  return L.join('\n');
}

export function showRunningConfig(_net: Network, dev: Device): string {
  const body = configBody(dev, dev.running);
  return `Building configuration...\n\nCurrent configuration : ${body.length} bytes\n${body}`;
}

export function showStartupConfig(_net: Network, dev: Device): string {
  if (!dev.startup) return 'startup-config is not present';
  const body = configBody(dev, dev.startup);
  return `Using ${body.length} bytes\n${body}`;
}

function wrapPorts(ports: string[]): string[] {
  const lines: string[] = [];
  for (let i = 0; i < ports.length; i += 4) lines.push(ports.slice(i, i + 4).join(', '));
  return lines.length ? lines : [''];
}

export function showVlanBrief(dev: Device): string {
  const out = [
    'VLAN Name                             Status    Ports',
    '---- -------------------------------- --------- -------------------------------',
  ];
  const ids = Object.keys(dev.running.vlans).map(Number).sort((a, b) => a - b);
  for (const id of ids) {
    const ports = physicalPorts('switch')
      .map((n) => dev.iface(n)!)
      .filter((i) => i.mode !== 'trunk' && (i.accessVlan ?? 1) === id)
      .map((i) => shortName(i.name));
    const status = id >= 1002 && id <= 1005 ? 'act/unsup' : 'active';
    const [first, ...rest] = wrapPorts(ports);
    out.push(`${String(id).padEnd(4)} ${dev.running.vlans[String(id)]!.name.padEnd(32)} ${status.padEnd(9)} ${first}`.trimEnd());
    for (const r of rest) out.push(`${' '.repeat(48)}${r}`);
  }
  return out.join('\n');
}

function statusName(n: string): string {
  return n.startsWith('GigabitEthernet') ? 'Gig' + n.slice('GigabitEthernet'.length) : shortName(n);
}

export function showInterfacesStatus(net: Network, dev: Device): string {
  const out = ['Port      Name               Status       Vlan       Duplex  Speed Type'];
  for (const n of physicalPorts('switch')) {
    const i = dev.iface(n)!;
    const status = i.shutdown ? 'disabled' : net.linkUp(dev.id, n) ? 'connected' : 'notconnect';
    const vlan = i.mode === 'trunk' ? 'trunk' : String(i.accessVlan ?? 1);
    const type = n.startsWith('Gigabit') ? '10/100/1000BaseTX' : '10/100BaseTX';
    out.push(
      `${statusName(n).padEnd(10)}${(i.description ?? '').slice(0, 18).padEnd(19)}${status.padEnd(13)}${vlan.padEnd(11)}auto    auto  ${type}`,
    );
  }
  return out.join('\n');
}

export function showInterfacesTrunk(net: Network, dev: Device): string {
  const trunks = physicalPorts('switch')
    .map((n) => dev.iface(n)!)
    .filter((i) => i.mode === 'trunk' && net.linkUp(dev.id, i.name));
  if (trunks.length === 0) return '';
  const existing = Object.keys(dev.running.vlans).map(Number).sort((a, b) => a - b);
  const allowedList = (i: InterfaceConfig) =>
    i.trunkAllowed === 'all' || i.trunkAllowed === undefined
      ? '1-1005'
      : i.trunkAllowed.length
        ? formatVlanList(i.trunkAllowed)
        : 'none';
  const active = (i: InterfaceConfig) => {
    const v = existing.filter((id) => vlanAllowed(i.trunkAllowed, id) && !(id >= 1002 && id <= 1005));
    return v.length ? formatVlanList(v) : 'none';
  };
  const out = ['Port        Mode         Encapsulation  Status        Native vlan'];
  for (const i of trunks) out.push(`${statusName(i.name).padEnd(12)}on           802.1q         trunking      1`);
  out.push('', 'Port        Vlans allowed on trunk');
  for (const i of trunks) out.push(`${statusName(i.name).padEnd(12)}${allowedList(i)}`);
  out.push('', 'Port        Vlans allowed and active in management domain');
  for (const i of trunks) out.push(`${statusName(i.name).padEnd(12)}${active(i)}`);
  out.push('', 'Port        Vlans in spanning tree forwarding state and not pruned');
  for (const i of trunks) out.push(`${statusName(i.name).padEnd(12)}${active(i)}`);
  return out.join('\n');
}

export function showIpInterfaceBrief(net: Network, dev: Device): string {
  const out = ['Interface              IP-Address      OK? Method Status                Protocol '];
  const row = (name: string, ip: string, method: string, status: string, proto: string) =>
    `${name.padEnd(23)}${ip.padEnd(16)}YES ${method.padEnd(7)}${status.padEnd(22)}${proto} `;
  for (const i of orderedInterfaces(dev, dev.running)) {
    const up = net.ifaceUp(dev.id, i.name);
    const parentShut = dev.iface(parentInterface(i.name))?.shutdown ?? false;
    const status = i.shutdown || parentShut ? 'administratively down' : up ? 'up' : 'down';
    out.push(row(i.name, i.ip?.address ?? 'unassigned', i.ip ? 'manual' : 'unset', status, up ? 'up' : 'down'));
  }
  if (dev.kind === 'switch') out.push(row('Vlan1', 'unassigned', 'unset', 'administratively down', 'down'));
  return out.join('\n');
}

/** A stable, made-up MAC per device. */
export function macFor(deviceId: string): string {
  let h = 0x2f1a;
  for (let i = 0; i < deviceId.length; i++) h = (Math.imul(h, 31) + deviceId.charCodeAt(i)) >>> 0;
  const hex = h.toString(16).padStart(8, '0');
  return `0060.${hex.slice(0, 4)}.${hex.slice(4, 8)}`;
}

export function showMacAddressTable(net: Network, dev: Device): string {
  const out = [
    '          Mac Address Table',
    '-------------------------------------------',
    '',
    'Vlan    Mac Address       Type        Ports',
    '----    -----------       --------    -----',
    '',
  ];
  const rows: [number, string, string][] = [];
  for (const n of physicalPorts('switch')) {
    if (!net.linkUp(dev.id, n)) continue;
    const peer = net.peer(dev.id, n)!;
    const other = net.device(peer.device);
    if (other.kind === 'switch') continue;
    const i = dev.iface(n)!;
    if (i.mode === 'trunk') {
      for (const s of Object.values(other.running.interfaces)) {
        if (s.encapsulationVlan !== undefined && vlanAllowed(i.trunkAllowed, s.encapsulationVlan)) {
          rows.push([s.encapsulationVlan, macFor(peer.device), shortName(n)]);
        }
      }
    } else {
      rows.push([i.accessVlan ?? 1, macFor(peer.device), shortName(n)]);
    }
  }
  rows.sort((a, b) => a[0] - b[0]);
  for (const [vlan, mac, port] of rows) out.push(`${String(vlan).padStart(4)}    ${mac}    DYNAMIC     ${port}`);
  return out.join('\n');
}

export function showVersion(dev: Device): string {
  const host = dev.running.hostname;
  if (dev.kind === 'switch') {
    return [
      'Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE4, RELEASE SOFTWARE (fc1)',
      'Technical Support: http://www.cisco.com/techsupport',
      '',
      `${host} uptime is 0 minutes`,
      'System image file is "flash:c2960-lanbasek9-mz.150-2.SE4.bin"',
      '',
      'cisco WS-C2960-24TT-L (PowerPC405) processor with 65536K bytes of memory.',
      '24 FastEthernet interfaces',
      '2 Gigabit Ethernet interfaces',
      '',
      'Configuration register is 0xF',
    ].join('\n');
  }
  return [
    'Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.1(4)M4, RELEASE SOFTWARE (fc2)',
    'Technical Support: http://www.cisco.com/techsupport',
    '',
    `${host} uptime is 0 minutes`,
    'System image file is "flash0:c2900-universalk9-mz.SPA.151-4.M4.bin"',
    '',
    'Cisco CISCO2911/K9 (revision 1.0) with 491520K/32768K bytes of memory.',
    '3 Gigabit Ethernet interfaces',
    '',
    'Configuration register is 0x2102',
  ].join('\n');
}
