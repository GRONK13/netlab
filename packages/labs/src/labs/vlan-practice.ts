import type { Lab } from '../types.ts';

const pcs = [1, 2, 3];

/** Guided practice for Module 2: VLANs are broadcast domains, whatever the addresses say. */
export const vlanPractice: Lab = {
  id: 'vlan-practice',
  title: 'One Switch, Two Networks',
  summary: 'Create VLANs, move ports into them, and watch which PCs can still talk.',
  ccnaDomain: 'Network Access',
  difficulty: 'Beginner',
  xp: 50,
  guided: true,
  briefing: `Three PCs share one switch and one subnet, and right now they can all reach each other: every switch port starts in VLAN 1.

You'll split them up one step at a time. Double-click **SW1** to open its console, then use \`enable\` and \`configure terminal\` to start configuring. You can check your work any time with \`show vlan brief\`, and test from a PC's **Command Prompt** with \`ping\`.

The PCs keep the same addresses throughout. Only the VLANs change. Each step explains itself once you've done it.`,
  topology: {
    devices: [
      { id: 'SW1', kind: 'switch', x: 50, y: 25 },
      ...pcs.map((n) => ({
        id: `PC${n}`,
        kind: 'pc' as const,
        x: 18 + (n - 1) * 32,
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
    {
      label: 'Create VLAN 10 and name it STAFF',
      check: { type: 'vlanName', device: 'SW1', vlan: 10, name: 'STAFF' },
      why: 'VLAN 10 now exists in the switch, named STAFF. No ports are in it yet, so nothing has changed for the PCs.',
    },
    {
      label: 'Make Fa0/1 (PC1) an access port in VLAN 10',
      check: { type: 'accessVlan', device: 'SW1', port: 'Fa0/1', vlan: 10 },
      why: "PC1's port now belongs to VLAN 10. PC1 itself knows nothing about it: the switch decides the VLAN, and PC1's frames stay untagged.",
    },
    {
      label: "PC1 can't reach PC3 any more (try ping 192.168.1.13 from PC1)",
      check: {
        type: 'all',
        checks: [
          { type: 'accessVlan', device: 'SW1', port: 'Fa0/1', vlan: 10 },
          { type: 'ping', from: 'PC1', to: '192.168.1.13', expect: false },
        ],
      },
      why: "PC3's port is still in VLAN 1. Same subnet, same switch, but different VLANs are different broadcast domains, so PC1's ARP request never reaches PC3.",
    },
    {
      label: 'Put Fa0/2 (PC2) in VLAN 10 as well',
      check: { type: 'accessVlan', device: 'SW1', port: 'Fa0/2', vlan: 10 },
      why: 'Now two ports share VLAN 10. A VLAN is just a group of ports that act like their own switch.',
    },
    {
      label: 'PC1 can reach PC2 again (try ping 192.168.1.12 from PC1)',
      check: {
        type: 'all',
        checks: [
          { type: 'accessVlan', device: 'SW1', port: 'Fa0/2', vlan: 10 },
          { type: 'ping', from: 'PC1', to: '192.168.1.12', expect: true },
        ],
      },
      why: 'PC1 and PC2 are in the same VLAN, so they are in one broadcast domain again: ARP gets through and the ping works.',
    },
    {
      label: 'Create VLAN 20 named GUEST and put Fa0/3 (PC3) in it',
      check: {
        type: 'all',
        checks: [
          { type: 'vlanName', device: 'SW1', vlan: 20, name: 'GUEST' },
          { type: 'accessVlan', device: 'SW1', port: 'Fa0/3', vlan: 20 },
        ],
      },
      why: "Every group gets its own VLAN, and usually its own subnet too. PC3 can't reach STAFF, and STAFF can't reach PC3, until a router joins the VLANs. That's Module 3.",
    },
  ],
  hints: [
    'In SW1: `enable`, `configure terminal`, then `vlan 10` and `name STAFF`.',
    'Then `interface fa0/1`, `switchport mode access`, `switchport access vlan 10`. Do the same on `fa0/2`.',
    'For PC3: `vlan 20`, `name GUEST`, then `interface fa0/3`, `switchport mode access`, `switchport access vlan 20`.',
  ],
};
