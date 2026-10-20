import type { Lab } from '../types.ts';

const pcs = [1, 2, 3, 4];

export const vlans: Lab = {
  id: 'separate-departments',
  title: 'Separate the Departments',
  summary: 'Use VLANs so Sales and HR share one switch but can no longer reach each other.',
  ccnaDomain: 'Network Access',
  difficulty: 'Beginner',
  xp: 150,
  briefing: `Sales and HR share one switch, and right now every PC can reach every other PC. HR wants its traffic kept apart.

Split the switch into two VLANs:
- VLAN \`10\` named \`SALES\`: PC1 on Fa0/1 and PC2 on Fa0/2
- VLAN \`20\` named \`HR\`: PC3 on Fa0/3 and PC4 on Fa0/4

All four PCs use the same subnet, so only the VLANs keep them apart. Check your work with \`show vlan brief\` on SW1, and \`ping\` from the PCs.`,
  topology: {
    devices: [
      { id: 'SW1', kind: 'switch', x: 50, y: 25 },
      ...pcs.map((n) => ({
        id: `PC${n}`,
        kind: 'pc' as const,
        x: 12 + (n - 1) * 25.3,
        y: 78,
        pc: { ip: `192.168.1.${10 + n}`, mask: '255.255.255.0' },
      })),
    ],
    links: pcs.map((n) => ({
      a: { device: 'SW1', port: `FastEthernet0/${n}` },
      b: { device: `PC${n}`, port: 'FastEthernet0' },
    })),
  },
  objectives: [
    { label: 'VLAN 10 exists and is named SALES', check: { type: 'vlanName', device: 'SW1', vlan: 10, name: 'SALES' } },
    { label: 'VLAN 20 exists and is named HR', check: { type: 'vlanName', device: 'SW1', vlan: 20, name: 'HR' } },
    ...[1, 2].map((p) => ({
      label: `Fa0/${p} is an access port in VLAN 10`,
      check: { type: 'accessVlan' as const, device: 'SW1', port: `Fa0/${p}`, vlan: 10 },
    })),
    ...[3, 4].map((p) => ({
      label: `Fa0/${p} is an access port in VLAN 20`,
      check: { type: 'accessVlan' as const, device: 'SW1', port: `Fa0/${p}`, vlan: 20 },
    })),
    { label: 'PC1 can ping PC2 (Sales)', check: { type: 'ping', from: 'PC1', to: '192.168.1.12', expect: true } },
    { label: 'PC3 can ping PC4 (HR)', check: { type: 'ping', from: 'PC3', to: '192.168.1.14', expect: true } },
    { label: 'PC1 can no longer ping PC3', check: { type: 'ping', from: 'PC1', to: '192.168.1.13', expect: false } },
  ],
  hints: [
    'Create a VLAN in global config with `vlan 10`, then give it a name with `name SALES`.',
    'Select a port with `interface fa0/1`, or several at once with `interface range fa0/1 - 2`.',
    'On each port use `switchport mode access` and `switchport access vlan 10` (or 20 for HR).',
  ],
};
