import type { DeviceKind } from './types.ts';

const TYPES = [
  { full: 'FastEthernet', short: 'Fa', min: 1 },
  { full: 'GigabitEthernet', short: 'Gi', min: 1 },
  { full: 'Vlan', short: 'Vl', min: 1 },
] as const;

export interface ParsedInterface {
  type: string;
  /** "0/1" */
  slot: string;
  sub?: number;
}

/** Physical ports for each device kind, in display order. */
export function physicalPorts(kind: DeviceKind): string[] {
  if (kind === 'switch') {
    const ports: string[] = [];
    for (let i = 1; i <= 24; i++) ports.push(`FastEthernet0/${i}`);
    ports.push('GigabitEthernet0/1', 'GigabitEthernet0/2');
    return ports;
  }
  if (kind === 'router') return ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2'];
  return ['FastEthernet0'];
}

/**
 * Parses an interface name the way IOS accepts it: any unique prefix of the type
 * ("f", "fa", "fastethernet", "g", "gi") followed by the number, with or without a space.
 */
export function parseInterfaceName(input: string): ParsedInterface | null {
  const m = /^([a-z]+)\s*(\d+(?:\/\d+)*)(?:\.(\d+))?$/i.exec(input.trim());
  if (!m) return null;
  const prefix = m[1]!.toLowerCase();
  const matches = TYPES.filter((t) => t.full.toLowerCase().startsWith(prefix));
  if (matches.length !== 1) return null;
  const sub = m[3] === undefined ? undefined : Number(m[3]);
  return { type: matches[0]!.full, slot: m[2]!, sub };
}

export function formatInterface(p: ParsedInterface): string {
  return `${p.type}${p.slot}${p.sub === undefined ? '' : `.${p.sub}`}`;
}

/** "FastEthernet0/1" -> "Fa0/1", "GigabitEthernet0/1" -> "Gi0/1" */
export function shortName(full: string): string {
  for (const t of TYPES) {
    if (full.startsWith(t.full)) return t.short + full.slice(t.full.length);
  }
  return full;
}

/** Physical parent of a subinterface: "GigabitEthernet0/0.10" -> "GigabitEthernet0/0". */
export function parentInterface(name: string): string {
  const dot = name.indexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}

/**
 * Expands an `interface range` argument such as "fa0/1 - 4, fa0/7" or "f0/1-4"
 * into canonical names. Returns null if any part is malformed.
 */
export function expandRange(input: string): string[] | null {
  const out: string[] = [];
  for (const raw of input.split(',')) {
    const part = raw.trim();
    if (!part) return null;
    const m = /^(.*?)(\d+)\s*-\s*(\d+)$/.exec(part);
    if (m) {
      const first = parseInterfaceName(m[1]! + m[2]!);
      const last = Number(m[3]);
      if (!first || first.sub !== undefined) return null;
      const start = Number(m[2]);
      if (last < start) return null;
      const base = first.slot.slice(0, first.slot.length - m[2]!.length);
      for (let i = start; i <= last; i++) out.push(`${first.type}${base}${i}`);
    } else {
      const one = parseInterfaceName(part);
      if (!one || one.sub !== undefined) return null;
      out.push(formatInterface(one));
    }
  }
  return out;
}
