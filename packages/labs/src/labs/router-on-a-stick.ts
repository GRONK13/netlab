import type { Lab } from '../types.ts';

export const routerOnAStick: Lab = {
  id: 'router-on-a-stick',
  title: 'Router on a Stick',
  summary: 'Connect two VLANs through one router link using a trunk and dot1Q subinterfaces.',
  ccnaDomain: 'IP Connectivity',
  difficulty: 'Intermediate',
  xp: 200,
  briefing: `Sales (VLAN 10) and HR (VLAN 20) are already separated on SW1. Now management wants them to share a printer, so the two VLANs need to talk through R1.

R1 has only one cable to the switch, so carry both VLANs over it:
- Make SW1's \`Gi0/1\` a **trunk** that carries VLANs 10 and 20
- Turn on R1's \`Gi0/0\`
- Create subinterface \`Gi0/0.10\` for VLAN 10 with IP \`192.168.10.1/24\`
- Create subinterface \`Gi0/0.20\` for VLAN 20 with IP \`192.168.20.1/24\`

The PCs already use .1 as their default gateway. Finish when PC1 and PC2 can ping each other.`,
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
      { a: { device: 'R1', port: 'GigabitEthernet0/0' }, b: { device: 'SW1', port: 'GigabitEthernet0/1' } },
      { a: { device: 'SW1', port: 'FastEthernet0/1' }, b: { device: 'PC1', port: 'FastEthernet0' } },
      { a: { device: 'SW1', port: 'FastEthernet0/2' }, b: { device: 'PC2', port: 'FastEthernet0' } },
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
        'interface fa0/2',
        'switchport mode access',
        'switchport access vlan 20',
        'end',
        'write memory',
      ],
      R1: ['enable', 'configure terminal', 'hostname R1', 'end', 'write memory'],
    },
  },
  objectives: [
    { label: 'SW1 Gi0/1 is a trunk', check: { type: 'trunk', device: 'SW1', port: 'Gi0/1' } },
    {
      label: 'The trunk carries VLANs 10 and 20',
      check: { type: 'trunkAllows', device: 'SW1', port: 'Gi0/1', vlans: [10, 20] },
    },
    { label: 'R1 Gi0/0 is up', check: { type: 'interfaceUp', device: 'R1', port: 'Gi0/0' } },
    {
      label: 'Gi0/0.10 uses dot1Q 10 with 192.168.10.1/24',
      check: { type: 'subinterface', device: 'R1', port: 'Gi0/0.10', vlan: 10, ip: '192.168.10.1', mask: '255.255.255.0' },
    },
    {
      label: 'Gi0/0.20 uses dot1Q 20 with 192.168.20.1/24',
      check: { type: 'subinterface', device: 'R1', port: 'Gi0/0.20', vlan: 20, ip: '192.168.20.1', mask: '255.255.255.0' },
    },
    { label: 'PC1 can ping PC2', check: { type: 'ping', from: 'PC1', to: '192.168.20.10', expect: true } },
    { label: 'PC2 can ping PC1', check: { type: 'ping', from: 'PC2', to: '192.168.10.10', expect: true } },
  ],
  hints: [
    'On SW1: `interface g0/1`, then `switchport mode trunk`. Check it with `show interfaces trunk`.',
    'Router interfaces start shut down. On R1: `interface g0/0`, then `no shutdown`.',
    'Create each subinterface with `interface g0/0.10`. Set `encapsulation dot1Q 10` first, then `ip address 192.168.10.1 255.255.255.0`.',
  ],
};
