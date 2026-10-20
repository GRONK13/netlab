// Objective checks. The browser runs these for live feedback; the server runs the
// exact same code on a replayed network to decide whether XP is awarded.

import { stableStringify, vlanAllowed } from './config.ts';
import { formatInterface, parseInterfaceName } from './interfaces.ts';
import { inSubnet, isIp, maskToPrefix, parseCidr, subnetOf } from './ipv4.ts';
import type { Network } from './network.ts';

export type Check =
  | { type: 'hostname'; device: string; value: string }
  | { type: 'enableSecret'; device: string; value: string }
  | { type: 'linePassword'; device: string; line: 'con' | 'vty'; value: string }
  | { type: 'passwordEncryption'; device: string }
  | { type: 'bannerContains'; device: string; text: string }
  | { type: 'configSaved'; device: string }
  | { type: 'vlanName'; device: string; vlan: number; name: string }
  | { type: 'accessVlan'; device: string; port: string; vlan: number }
  | { type: 'trunk'; device: string; port: string }
  | { type: 'trunkAllows'; device: string; port: string; vlans: number[] }
  | { type: 'interfaceUp'; device: string; port: string }
  | { type: 'subinterface'; device: string; port: string; vlan: number; ip: string; mask: string }
  /** `to` is an IP address, or a PC's device id to ping whatever address it has. */
  | { type: 'ping'; from: string; to: string; expect: boolean }
  /**
   * The device's address (a PC's, or a router interface's when `port` is set) is a usable
   * host in `network` (CIDR) with the matching mask; with `ip`, exactly that address.
   */
  | { type: 'address'; device: string; port?: string; network: string; ip?: string }
  | { type: 'gateway'; device: string; ip: string }
  /** Every check passes: one objective for things that belong together. */
  | { type: 'all'; checks: Check[] };

function canon(port: string): string {
  const p = parseInterfaceName(port);
  return p ? formatInterface(p) : port;
}

function addressOf(net: Network, device: string, port?: string): { ip: string; mask: string } | undefined {
  const dev = net.devices.get(device);
  if (!port) {
    const pc = dev?.running.pc;
    return pc?.ip && pc.mask ? { ip: pc.ip, mask: pc.mask } : undefined;
  }
  const ip = dev?.iface(canon(port))?.ip;
  return ip ? { ip: ip.address, mask: ip.mask } : undefined;
}

export function evaluate(net: Network, c: Check): boolean {
  if (c.type === 'all') return c.checks.every((x) => evaluate(net, x));
  if (c.type === 'ping') {
    const to = isIp(c.to) ? c.to : net.devices.get(c.to)?.running.pc?.ip;
    // A target with no address can't be reached.
    if (!to) return !c.expect;
    return net.ping(c.from, to).success === c.expect;
  }
  if (c.type === 'address') {
    const want = parseCidr(c.network);
    const have = addressOf(net, c.device, c.port);
    if (!want || !have || maskToPrefix(have.mask) !== want.prefix) return false;
    if (c.ip) return have.ip === c.ip;
    const s = subnetOf(want.ip, want.prefix);
    return inSubnet(have.ip, s.network, s.prefix) && have.ip !== s.network && have.ip !== s.broadcast;
  }
  const dev = net.devices.get(c.device);
  if (!dev) return false;
  const cfg = dev.running;
  switch (c.type) {
    case 'hostname':
      return cfg.hostname === c.value;
    case 'enableSecret':
      return cfg.enableSecret === c.value;
    case 'linePassword': {
      // For vty, the five default lines 0-4 must all be set.
      const lines = c.line === 'con' ? [cfg.con] : cfg.vty.slice(0, 5);
      return lines.every((l) => l.password === c.value && l.login);
    }
    case 'passwordEncryption':
      return cfg.servicePasswordEncryption;
    case 'bannerContains':
      return (cfg.bannerMotd ?? '').toLowerCase().includes(c.text.toLowerCase());
    case 'configSaved':
      return dev.startup !== null && stableStringify(dev.startup) === stableStringify(cfg);
    case 'vlanName':
      return cfg.vlans[String(c.vlan)]?.name === c.name;
    case 'accessVlan': {
      const i = dev.iface(canon(c.port));
      return !!i && i.mode !== 'trunk' && i.accessVlan === c.vlan;
    }
    case 'trunk':
      return dev.iface(canon(c.port))?.mode === 'trunk';
    case 'trunkAllows': {
      const i = dev.iface(canon(c.port));
      return !!i && i.mode === 'trunk' && c.vlans.every((v) => vlanAllowed(i.trunkAllowed, v));
    }
    case 'interfaceUp':
      return net.ifaceUp(dev.id, canon(c.port));
    case 'gateway':
      return cfg.pc?.gateway === c.ip;
    case 'subinterface': {
      const i = dev.iface(canon(c.port));
      return (
        !!i &&
        i.encapsulationVlan === c.vlan &&
        i.ip?.address === c.ip &&
        i.ip.mask === c.mask &&
        net.ifaceUp(dev.id, i.name)
      );
    }
  }
}

export function evaluateAll(net: Network, checks: Check[]): boolean[] {
  return checks.map((c) => evaluate(net, c));
}
