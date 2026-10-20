// Deterministic reachability: instead of simulating packets over time, ping walks
// the topology the way a frame would travel (VLANs, trunks, hubs, shutdown ports)
// and the way a router forwards between its connected subnets.

import { isEndpoint } from './catalog.ts';
import { vlanAllowed } from './config.ts';
import { parentInterface } from './interfaces.ts';
import type { Device, Network } from './network.ts';
import { ipToInt } from './parser.ts';
import { macFor } from './show.ts';

export interface Hop {
  ip: string;
  device: string;
}

export interface PingResult {
  success: boolean;
  /** Device ids the packet passed through at layer 3. */
  path: string[];
  /** Each layer 3 hop that answered on the way out (router interfaces, then the target). */
  hops: Hop[];
  /** Why it failed, in plain words (for hints and the tutor). */
  reason?: string;
}

interface L3If {
  device: string;
  iface: string;
  ip: string;
  mask: string;
  gateway?: string;
}

function sameSubnet(a: string, b: string, mask: string): boolean {
  const m = ipToInt(mask);
  return ((ipToInt(a) & m) >>> 0) === ((ipToInt(b) & m) >>> 0);
}

/** Layer 3 interfaces of a device that are up and have an address. */
function l3Interfaces(net: Network, dev: Device): L3If[] {
  if (isEndpoint(dev.kind)) {
    const pc = dev.running.pc;
    if (!pc?.ip || !pc.mask || !net.linkUp(dev.id, 'FastEthernet0')) return [];
    return [{ device: dev.id, iface: 'FastEthernet0', ip: pc.ip, mask: pc.mask, gateway: pc.gateway }];
  }
  if (dev.kind === 'router') {
    return Object.values(dev.running.interfaces)
      .filter((i) => i.ip && net.ifaceUp(dev.id, i.name))
      .filter((i) => !i.name.includes('.') || i.encapsulationVlan !== undefined)
      .map((i) => ({ device: dev.id, iface: i.name, ip: i.ip!.address, mask: i.ip!.mask }));
  }
  return [];
}

/** Every layer 3 endpoint that shares a broadcast domain with `src`. */
function l2Neighbors(net: Network, src: L3If): L3If[] {
  const found: L3If[] = [];
  const seen = new Set<string>();
  const srcDev = net.device(src.device);
  const srcIf = srcDev.iface(src.iface)!;
  const port = parentInterface(src.iface);
  const tag = srcIf.encapsulationVlan ?? null;

  const emit = (deviceId: string, out: string, t: number | null) => {
    if (!net.linkUp(deviceId, out)) return;
    const peer = net.peer(deviceId, out)!;
    arrive(peer.device, peer.port, t);
  };

  const arrive = (deviceId: string, inPort: string, t: number | null) => {
    const dev = net.device(deviceId);
    if (isEndpoint(dev.kind)) {
      if (t === null) found.push(...l3Interfaces(net, dev));
      return;
    }
    if (dev.kind === 'router') {
      for (const i of l3Interfaces(net, dev)) {
        if (parentInterface(i.iface) !== inPort) continue;
        const enc = dev.iface(i.iface)!.encapsulationVlan;
        if ((t === null && i.iface === inPort) || (t !== null && enc === t)) found.push(i);
      }
      return;
    }
    if (dev.kind === 'hub') {
      // A hub is a repeater: every frame goes out every other port, unchanged.
      const key = `${deviceId}|hub|${t}`;
      if (seen.has(key)) return;
      seen.add(key);
      for (const out of dev.ports) if (out !== inPort) emit(deviceId, out, t);
      return;
    }
    // Switch: classify the frame into a VLAN, then flood it within that VLAN.
    const cfg = dev.iface(inPort)!;
    let vlan: number;
    if (cfg.mode === 'trunk') {
      vlan = t ?? 1;
      if (!vlanAllowed(cfg.trunkAllowed, vlan)) return;
    } else {
      if (t !== null) return;
      vlan = cfg.accessVlan ?? 1;
    }
    if (!dev.running.vlans[String(vlan)]) return;
    const key = `${deviceId}|${vlan}`;
    if (seen.has(key)) return;
    seen.add(key);
    for (const out of Object.values(dev.running.interfaces)) {
      if (out.name === inPort) continue;
      if (out.mode === 'trunk') {
        if (vlanAllowed(out.trunkAllowed, vlan)) emit(deviceId, out.name, vlan === 1 ? null : vlan);
      } else if ((out.accessVlan ?? 1) === vlan) {
        emit(deviceId, out.name, null);
      }
    }
  };

  emit(src.device, port, tag);
  return found.filter((f) => !(f.device === src.device && f.iface === src.iface));
}

/** Picks the interface a device sends from when talking to `dstIp`. */
function sourceFor(net: Network, dev: Device, dstIp: string): L3If | undefined {
  const ifs = l3Interfaces(net, dev);
  if (isEndpoint(dev.kind)) return ifs[0];
  return ifs.find((i) => i.ip === dstIp) ?? ifs.find((i) => sameSubnet(i.ip, dstIp, i.mask));
}

interface Delivery {
  success: boolean;
  path: string[];
  hops: Hop[];
  reason?: string;
  end?: L3If;
}

function deliver(net: Network, start: L3If, dstIp: string, path: string[]): Delivery {
  const hops: Hop[] = [];
  let from = start;
  for (let hop = 0; hop < 8; hop++) {
    if (from.ip === dstIp) return { success: true, path, hops, end: from };
    const nextHop = sameSubnet(from.ip, dstIp, from.mask) ? dstIp : from.gateway;
    const host = net.device(from.device).running.hostname;
    if (!nextHop) {
      return {
        success: false,
        path,
        hops,
        reason: isEndpoint(net.device(from.device).kind)
          ? `${host} has no default gateway, so it can't reach other networks`
          : `${host} has no route to ${dstIp}`,
      };
    }
    const target = l2Neighbors(net, from).find((n) => n.ip === nextHop);
    if (!target) {
      return {
        success: false,
        path,
        hops,
        reason:
          nextHop === dstIp
            ? `${dstIp} isn't reachable from ${host} on the local network (check VLANs, trunks and shut down ports)`
            : `${host}'s default gateway ${nextHop} isn't reachable (check VLANs, trunks and the router interface)`,
      };
    }
    path.push(target.device);
    hops.push({ ip: target.ip, device: target.device });
    if (target.ip === dstIp) return { success: true, path, hops, end: target };
    const router = net.device(target.device);
    if (router.kind !== 'router') {
      return { success: false, path, hops, reason: `${router.running.hostname} is not a router` };
    }
    const egress = sourceFor(net, router, dstIp);
    if (!egress) {
      return { success: false, path, hops, reason: `${router.running.hostname} has no route to ${dstIp}` };
    }
    if (egress.ip === dstIp) return { success: true, path, hops, end: egress };
    from = { ...egress, gateway: undefined };
  }
  return { success: false, path, hops, reason: 'Too many hops' };
}

export function ping(net: Network, fromId: string, dstIp: string): PingResult {
  const dev = net.device(fromId);
  const src = sourceFor(net, dev, dstIp);
  if (!src) {
    const reason = isEndpoint(dev.kind)
      ? `${dev.running.hostname} has no IP address or its cable/port is down`
      : `${dev.running.hostname} has no interface in the ${dstIp} network that is up`;
    return { success: false, path: [fromId], hops: [], reason };
  }
  const there = deliver(net, src, dstIp, [fromId]);
  if (!there.success || !there.end) {
    return { success: false, path: there.path, hops: there.hops, reason: there.reason };
  }
  // The reply has to make it back too (e.g. the destination needs a gateway).
  const replyFrom = sourceFor(net, net.device(there.end.device), src.ip) ?? there.end;
  const back = deliver(net, replyFrom, src.ip, []);
  if (!back.success) {
    return { success: false, path: there.path, hops: there.hops, reason: `Reply couldn't get back: ${back.reason}` };
  }
  return { success: true, path: there.path, hops: there.hops };
}

/** Pings, and records the first hop's MAC in the sender's ARP cache like a real host would. */
export function pingAndLearn(net: Network, fromId: string, dstIp: string): PingResult {
  const r = ping(net, fromId, dstIp);
  const first = r.hops[0];
  if (first) net.device(fromId).arp.set(first.ip, macFor(first.device));
  return r;
}

/** IOS-style ping output for routers and switches. */
export function routerPingOutput(net: Network, fromId: string, dstIp: string): string {
  const r = ping(net, fromId, dstIp);
  const head = `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${dstIp}, timeout is 2 seconds:\n`;
  return r.success
    ? `${head}!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 0/0/1 ms`
    : `${head}.....\nSuccess rate is 0 percent (0/5)`;
}

/** Windows-style ping output for end devices. */
export function pcPingOutput(net: Network, fromId: string, dstIp: string, count = 4): string {
  const r = pingAndLearn(net, fromId, dstIp);
  const lines = [`Pinging ${dstIp} with 32 bytes of data:`, ''];
  for (let i = 0; i < count; i++) {
    lines.push(r.success ? `Reply from ${dstIp}: bytes=32 time<1ms TTL=${128 - Math.max(0, r.hops.length - 1)}` : 'Request timed out.');
  }
  const rec = r.success ? count : 0;
  lines.push(
    '',
    `Ping statistics for ${dstIp}:`,
    `    Packets: Sent = ${count}, Received = ${rec}, Lost = ${count - rec} (${r.success ? 0 : 100}% loss),`,
  );
  if (r.success) {
    lines.push('Approximate round trip times in milli-seconds:', '    Minimum = 0ms, Maximum = 0ms, Average = 0ms');
  }
  return lines.join('\n');
}

/** Windows-style tracert: one line per router hop, then timeouts after the path breaks. */
export function tracertOutput(net: Network, fromId: string, dstIp: string): string {
  const r = pingAndLearn(net, fromId, dstIp);
  const reached = r.success ? r.hops : r.hops.filter((h) => h.ip !== dstIp);
  const lines = [`Tracing route to ${dstIp} over a maximum of 30 hops: `, ''];
  reached.forEach((h, i) => lines.push(`  ${String(i + 1).padStart(2)}   0 ms      0 ms      0 ms      ${h.ip}`));
  if (!r.success) {
    for (let i = reached.length + 1; i <= 30; i++) {
      lines.push(`  ${String(i).padStart(2)}   *         *         *         Request timed out.`);
    }
  }
  lines.push('', 'Trace complete.');
  return lines.join('\n');
}
