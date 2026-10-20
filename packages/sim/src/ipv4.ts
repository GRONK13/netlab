// IPv4 subnet arithmetic, shared by grader checks and the subnetting trainer.
// Addresses are handled as unsigned 32-bit integers.

import { ipToInt, isIp, isMask } from './parser.ts';

export { ipToInt, isIp, isMask };

export interface Subnet {
  network: string;
  broadcast: string;
  prefix: number;
  mask: string;
  /** First and last usable host. A /31 uses both addresses (RFC 3021); a /32 is one host. */
  first: string;
  last: string;
  /** Usable hosts: 2^h - 2, except /31 (2) and /32 (1). */
  hosts: number;
}

export function intToIp(n: number): string {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
}

function maskBits(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/** 24 → "255.255.255.0" */
export function prefixToMask(prefix: number): string {
  return intToIp(maskBits(prefix));
}

/** "255.255.255.0" → 24, or null if it isn't a valid mask. */
export function maskToPrefix(mask: string): number | null {
  if (!isMask(mask)) return null;
  const n = ipToInt(mask);
  let prefix = 0;
  while (prefix < 32 && n & (0x80000000 >>> prefix)) prefix++;
  return prefix;
}

/** "192.168.1.0/24" → { ip, prefix }, or null. */
export function parseCidr(s: string): { ip: string; prefix: number } | null {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(s.trim());
  if (!m || !isIp(m[1]!) || Number(m[2]) > 32) return null;
  return { ip: m[1]!, prefix: Number(m[2]) };
}

export function subnetOf(ip: string, prefix: number): Subnet {
  const mask = maskBits(prefix);
  const net = (ipToInt(ip) & mask) >>> 0;
  const bcast = (net | ~mask) >>> 0;
  const hosts = prefix >= 31 ? 2 ** (32 - prefix) : 2 ** (32 - prefix) - 2;
  return {
    network: intToIp(net),
    broadcast: intToIp(bcast),
    prefix,
    mask: intToIp(mask),
    first: intToIp(prefix >= 31 ? net : net + 1),
    last: intToIp(prefix >= 31 ? bcast : bcast - 1),
    hosts,
  };
}

/** Is `ip` inside network/prefix? */
export function inSubnet(ip: string, network: string, prefix: number): boolean {
  const mask = maskBits(prefix);
  return (ipToInt(ip) & mask) >>> 0 === (ipToInt(network) & mask) >>> 0;
}

/** Longest prefix (smallest subnet) with room for `hosts` usable addresses, using 2^h - 2. */
export function prefixForHosts(hosts: number): number {
  let h = 2;
  while (2 ** h - 2 < hosts) h++;
  return 32 - h;
}
