// Every device students can place, with the ports each model has.

import type { DeviceKind } from './types.ts';

export interface DeviceModel {
  model: string;
  kind: DeviceKind;
  label: string;
  description: string;
  ports: string[];
}

const range = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

export const MODELS: DeviceModel[] = [
  {
    model: '1941',
    kind: 'router',
    label: 'Router 1941',
    description: '2 Gigabit Ethernet ports',
    ports: range('GigabitEthernet0/', 0, 1),
  },
  {
    model: '2911',
    kind: 'router',
    label: 'Router 2911',
    description: '3 Gigabit Ethernet ports',
    ports: range('GigabitEthernet0/', 0, 2),
  },
  {
    model: 'ISR4321',
    kind: 'router',
    label: 'Router ISR4321',
    description: '2 Gigabit ports, 3-part names (Gi0/0/0)',
    ports: range('GigabitEthernet0/0/', 0, 1),
  },
  {
    model: '2960-24TT',
    kind: 'switch',
    label: 'Switch 2960-24TT',
    description: '24 Fast Ethernet + 2 Gigabit uplinks',
    ports: [...range('FastEthernet0/', 1, 24), ...range('GigabitEthernet0/', 1, 2)],
  },
  {
    model: '2960-48TT',
    kind: 'switch',
    label: 'Switch 2960-48TT',
    description: '48 Fast Ethernet + 2 Gigabit uplinks',
    ports: [...range('FastEthernet0/', 1, 48), ...range('GigabitEthernet0/', 1, 2)],
  },
  {
    model: 'Hub-PT',
    kind: 'hub',
    label: 'Hub',
    description: '6 ports, repeats every frame out every port',
    ports: range('Port', 0, 5),
  },
  { model: 'PC-PT', kind: 'pc', label: 'PC', description: 'Desktop computer', ports: ['FastEthernet0'] },
  { model: 'Laptop-PT', kind: 'laptop', label: 'Laptop', description: 'Portable computer', ports: ['FastEthernet0'] },
  {
    model: 'Server-PT',
    kind: 'server',
    label: 'Server',
    description: 'Runs a web server (HTTP)',
    ports: ['FastEthernet0'],
  },
  {
    model: 'Printer-PT',
    kind: 'printer',
    label: 'Printer',
    description: 'Network printer with an IP address',
    ports: ['FastEthernet0'],
  },
];

export const KINDS: DeviceKind[] = ['router', 'switch', 'hub', 'pc', 'laptop', 'server', 'printer'];

export const DEFAULT_MODEL: Record<DeviceKind, string> = {
  router: '2911',
  switch: '2960-24TT',
  hub: 'Hub-PT',
  pc: 'PC-PT',
  laptop: 'Laptop-PT',
  server: 'Server-PT',
  printer: 'Printer-PT',
};

/** Packet Tracer-style id prefixes: Router0, Switch1, PC2... */
export const ID_BASE: Record<DeviceKind, string> = {
  router: 'Router',
  switch: 'Switch',
  hub: 'Hub',
  pc: 'PC',
  laptop: 'Laptop',
  server: 'Server',
  printer: 'Printer',
};

/** Hosts with an IP stack and a command prompt (no IOS). */
export function isEndpoint(kind: DeviceKind): boolean {
  return kind === 'pc' || kind === 'laptop' || kind === 'server' || kind === 'printer';
}

/** Devices with a Cisco IOS console. */
export function hasIos(kind: DeviceKind): boolean {
  return kind === 'router' || kind === 'switch';
}

export function modelInfo(spec: { kind: DeviceKind; model?: string }): DeviceModel {
  const m = spec.model ? MODELS.find((x) => x.model === spec.model && x.kind === spec.kind) : undefined;
  return m ?? MODELS.find((x) => x.model === DEFAULT_MODEL[spec.kind])!;
}

export function portsOf(spec: { kind: DeviceKind; model?: string }): string[] {
  return modelInfo(spec).ports;
}
