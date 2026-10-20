import { isEndpoint } from './catalog.ts';
import { physicalPorts } from './interfaces.ts';
import type { DeviceConfig, DeviceSpec, InterfaceConfig, VlanSet } from './types.ts';

export const DEFAULT_VLANS: Record<string, { name: string }> = {
  '1': { name: 'default' },
  '1002': { name: 'fddi-default' },
  '1003': { name: 'token-ring-default' },
  '1004': { name: 'fddinet-default' },
  '1005': { name: 'trnet-default' },
};

export function defaultHostname(spec: DeviceSpec): string {
  if (spec.hostname) return spec.hostname;
  if (spec.kind === 'switch') return 'Switch';
  if (spec.kind === 'router') return 'Router';
  return spec.id;
}

export function defaultConfig(spec: DeviceSpec): DeviceConfig {
  const interfaces: Record<string, InterfaceConfig> = {};
  for (const name of physicalPorts(spec.kind, spec.model)) {
    if (spec.kind === 'switch') {
      interfaces[name] = { name, shutdown: false, mode: 'access', accessVlan: 1, trunkAllowed: 'all' };
    } else if (spec.kind === 'router') {
      // Router interfaces start administratively down, like real IOS.
      interfaces[name] = { name, shutdown: true };
    } else {
      interfaces[name] = { name, shutdown: false };
    }
  }
  return {
    hostname: defaultHostname(spec),
    servicePasswordEncryption: false,
    con: { login: false },
    vty: Array.from({ length: 16 }, () => ({ login: false })),
    vlans: spec.kind === 'switch' ? clone(DEFAULT_VLANS) : {},
    interfaces,
    pc: isEndpoint(spec.kind) ? { ...spec.pc } : undefined,
  };
}

/** Deep copy of plain config data. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** JSON with sorted keys, so two configs compare equal regardless of edit order. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return v;
  });
}

export function vlanAllowed(set: VlanSet | undefined, vlan: number): boolean {
  if (set === undefined || set === 'all') return vlan >= 1 && vlan <= 4094;
  return set.includes(vlan);
}

/** Parses "10,20,30-32" into [10,20,30,31,32]. Returns null on bad input. */
export function parseVlanList(input: string): number[] | null {
  const out = new Set<number>();
  for (const part of input.split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (a < 1 || b > 4094 || b < a) return null;
    for (let v = a; v <= b; v++) out.add(v);
  }
  return [...out].sort((x, y) => x - y);
}

/** [1,2,3,10,20,21] -> "1-3,10,20-21" */
export function formatVlanList(vlans: number[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < vlans.length) {
    let j = i;
    while (j + 1 < vlans.length && vlans[j + 1] === vlans[j]! + 1) j++;
    parts.push(j === i ? `${vlans[i]}` : `${vlans[i]}-${vlans[j]}`);
    i = j + 1;
  }
  return parts.join(',');
}
