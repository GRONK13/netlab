import { Network, type TopologySpec } from '../src/index.ts';

/** One switch with four PCs on Fa0/1-4, all in 192.168.1.0/24. */
export const fourPcs: TopologySpec = {
  devices: [
    { id: 'SW1', kind: 'switch', x: 50, y: 30 },
    ...[1, 2, 3, 4].map((n) => ({
      id: `PC${n}`,
      kind: 'pc' as const,
      x: n * 20,
      y: 80,
      pc: { ip: `192.168.1.${10 + n}`, mask: '255.255.255.0' },
    })),
  ],
  links: [1, 2, 3, 4].map((n) => ({
    a: { device: 'SW1', port: `FastEthernet0/${n}` },
    b: { device: `PC${n}`, port: 'FastEthernet0' },
  })),
};

/** Router on a stick: R1 Gi0/0 to SW1 Gi0/1, PC1 in VLAN 10, PC2 in VLAN 20. */
export const roas: TopologySpec = {
  devices: [
    { id: 'R1', kind: 'router', x: 50, y: 10 },
    { id: 'SW1', kind: 'switch', x: 50, y: 45 },
    { id: 'PC1', kind: 'pc', x: 25, y: 85, pc: { ip: '192.168.10.10', mask: '255.255.255.0', gateway: '192.168.10.1' } },
    { id: 'PC2', kind: 'pc', x: 75, y: 85, pc: { ip: '192.168.20.10', mask: '255.255.255.0', gateway: '192.168.20.1' } },
  ],
  links: [
    { a: { device: 'R1', port: 'GigabitEthernet0/0' }, b: { device: 'SW1', port: 'GigabitEthernet0/1' } },
    { a: { device: 'SW1', port: 'FastEthernet0/1' }, b: { device: 'PC1', port: 'FastEthernet0' } },
    { a: { device: 'SW1', port: 'FastEthernet0/2' }, b: { device: 'PC2', port: 'FastEthernet0' } },
  ],
  setup: {
    SW1: [
      'en',
      'conf t',
      'vlan 10',
      'name SALES',
      'vlan 20',
      'name HR',
      'int fa0/1',
      'switchport mode access',
      'switchport access vlan 10',
      'int fa0/2',
      'switchport mode access',
      'switchport access vlan 20',
      'end',
    ],
  },
};

/** Runs lines on one device and returns all output joined. */
export function run(net: Network, device: string, lines: string[]): string {
  return lines.map((l) => net.exec(device, l)).join('\n');
}
