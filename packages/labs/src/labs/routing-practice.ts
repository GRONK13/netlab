import type { Lab } from '../types.ts';

/** Guided practice for Module 3: routing between two VLANs, one router port each. */
export const routingPractice: Lab = {
  id: 'routing-practice',
  title: 'Two Ports, Two VLANs',
  summary: 'Give a router an interface in each VLAN and watch traffic start flowing between them.',
  ccnaDomain: 'IP Connectivity',
  difficulty: 'Beginner',
  xp: 50,
  guided: true,
  briefing: `SW1 already separates Sales (VLAN 10) and HR (VLAN 20), so PC1 and PC2 can't reach each other. R1 is cabled to SW1 twice: \`Gi0/0\` lands on a port in VLAN 10 and \`Gi0/1\` on a port in VLAN 20.

The PCs already point at the router for their default gateway:
- PC1: \`192.168.10.10/24\`, gateway \`192.168.10.1\`
- PC2: \`192.168.20.10/24\`, gateway \`192.168.20.1\`

Your job is the router. Double-click **R1** to open its console, then \`enable\` and \`configure terminal\`. Each step explains itself once you've done it.`,
  topology: {
    devices: [
      { id: 'R1', kind: 'router', x: 50, y: 12 },
      { id: 'SW1', kind: 'switch', x: 50, y: 45 },
      {
        id: 'PC1',
        kind: 'pc',
        x: 25,
        y: 82,
        pc: { ip: '192.168.10.10', mask: '255.255.255.0', gateway: '192.168.10.1' },
      },
      {
        id: 'PC2',
        kind: 'pc',
        x: 75,
        y: 82,
        pc: { ip: '192.168.20.10', mask: '255.255.255.0', gateway: '192.168.20.1' },
      },
    ],
    links: [
      {
        a: { device: 'R1', port: 'GigabitEthernet0/0' },
        b: { device: 'SW1', port: 'GigabitEthernet0/1' },
      },
      {
        a: { device: 'R1', port: 'GigabitEthernet0/1' },
        b: { device: 'SW1', port: 'GigabitEthernet0/2' },
      },
      {
        a: { device: 'SW1', port: 'FastEthernet0/1' },
        b: { device: 'PC1', port: 'FastEthernet0' },
      },
      {
        a: { device: 'SW1', port: 'FastEthernet0/2' },
        b: { device: 'PC2', port: 'FastEthernet0' },
      },
    ],
    setup: {
      SW1: [
        'enable',
        'configure terminal',
        'hostname SW1',
        'vlan 10',
        'name SALES',
        'vlan 20',
        'name HR',
        'interface fa0/1',
        'switchport mode access',
        'switchport access vlan 10',
        'interface gi0/1',
        'switchport mode access',
        'switchport access vlan 10',
        'interface fa0/2',
        'switchport mode access',
        'switchport access vlan 20',
        'interface gi0/2',
        'switchport mode access',
        'switchport access vlan 20',
        'end',
        'write memory',
      ],
    },
  },
  objectives: [
    {
      label: 'Give R1 Gi0/0 the address 192.168.10.1 with mask 255.255.255.0',
      check: {
        type: 'address',
        device: 'R1',
        port: 'Gi0/0',
        network: '192.168.10.0/24',
        ip: '192.168.10.1',
      },
      why: "Gi0/0 is plugged into VLAN 10, and 192.168.10.1 is the gateway PC1 already uses. The router's interface is now part of Sales' subnet.",
    },
    {
      label: 'Bring R1 Gi0/0 up',
      check: { type: 'interfaceUp', device: 'R1', port: 'Gi0/0' },
      why: 'Router interfaces start shut down; `no shutdown` turned it on and the link light went green. A switch port is on by default, a router port is not.',
    },
    {
      label: 'PC1 can reach its gateway (try ping 192.168.10.1 from PC1)',
      check: { type: 'ping', from: 'PC1', to: '192.168.10.1', expect: true },
      why: "PC1 and R1's Gi0/0 share VLAN 10 and its subnet, so PC1 finds the router with ARP, just like any neighbour.",
    },
    {
      label: 'Give R1 Gi0/1 the address 192.168.20.1/24 and bring it up',
      check: {
        type: 'all',
        checks: [
          {
            type: 'address',
            device: 'R1',
            port: 'Gi0/1',
            network: '192.168.20.0/24',
            ip: '192.168.20.1',
          },
          { type: 'interfaceUp', device: 'R1', port: 'Gi0/1' },
        ],
      },
      why: 'R1 now has an interface in each subnet, so it knows both networks as connected routes, without any routing configuration.',
    },
    {
      label: 'PC1 can reach PC2 across R1 (try ping 192.168.20.10 from PC1)',
      check: { type: 'ping', from: 'PC1', to: '192.168.20.10', expect: true },
      why: "PC1 sends to its gateway because PC2 is on another subnet; R1 forwards out Gi0/1 into VLAN 20, and the reply comes back through PC2's gateway. Routing joined the VLANs. Router on a Stick does the same over a single cable.",
    },
  ],
  hints: [
    'On R1: `enable`, `configure terminal`, `interface g0/0`, `ip address 192.168.10.1 255.255.255.0`.',
    'Still on `g0/0`, type `no shutdown`. Router interfaces start shut down.',
    'Then `interface g0/1`, `ip address 192.168.20.1 255.255.255.0`, `no shutdown`.',
  ],
};
