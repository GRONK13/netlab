import type { Lab } from '../types.ts';

const pcs = [1, 2, 3, 4];

/** Guided practice for Module 1: what makes two hosts neighbours. */
export const ipPractice: Lab = {
  id: 'ip-practice',
  title: 'Same Subnet or Not?',
  summary: 'Address four PCs on one switch and see which ones can talk, and why.',
  ccnaDomain: 'Network Fundamentals',
  difficulty: 'Beginner',
  xp: 50,
  guided: true,
  briefing: `Four PCs share one switch, and none of them has an address yet. Being plugged into the same switch isn't enough: two PCs talk directly only when they agree they're on the same network.

Work through the steps one at a time. Open a PC by double-clicking it, then use **Command Prompt**:
- \`ipconfig <address> <mask>\` sets the address, for example \`ipconfig 192.168.1.10 255.255.255.0\`
- \`ping <address>\` tests whether another PC answers

The **IP Configuration** app on the desktop does the same as \`ipconfig\`. Each step explains itself once you've done it.`,
  topology: {
    devices: [
      { id: 'SW1', kind: 'switch', x: 50, y: 25 },
      ...pcs.map((n) => ({ id: `PC${n}`, kind: 'pc' as const, x: 12 + (n - 1) * 25.3, y: 78 })),
    ],
    links: pcs.map((n) => ({
      a: { device: 'SW1', port: `FastEthernet0/${n}` },
      b: { device: `PC${n}`, port: 'FastEthernet0' },
    })),
  },
  objectives: [
    {
      label: 'Give PC1 the address 192.168.1.10 with mask 255.255.255.0',
      check: { type: 'address', device: 'PC1', network: '192.168.1.0/24', ip: '192.168.1.10' },
      why: 'A /24 mask (255.255.255.0) makes the first three octets the network: PC1 is host .10 on network 192.168.1.0.',
    },
    {
      label: 'Give PC2 the address 192.168.1.20 with the same mask',
      check: { type: 'address', device: 'PC2', network: '192.168.1.0/24', ip: '192.168.1.20' },
      why: 'PC2 has the same network bits, 192.168.1, so PC1 and PC2 are on the same network.',
    },
    {
      label: 'Ping PC2 from PC1 and check it answers',
      check: { type: 'ping', from: 'PC1', to: 'PC2', expect: true },
      why: "Same network, so PC1 sends straight to PC2: it finds PC2's MAC address with ARP and the switch delivers the frame. No router needed.",
    },
    {
      label: 'Give PC3 the address 192.168.2.30 with mask 255.255.255.0',
      check: { type: 'address', device: 'PC3', network: '192.168.2.0/24', ip: '192.168.2.30' },
      why: '192.168.2 is a different network, even though PC3 is plugged into the same switch.',
    },
    {
      label: 'Ping PC3 from PC1: it should fail',
      check: {
        type: 'all',
        checks: [
          { type: 'address', device: 'PC3', network: '192.168.2.0/24' },
          { type: 'ping', from: 'PC1', to: 'PC3', expect: false },
        ],
      },
      why: 'PC1 sees that 192.168.2.30 is outside its network, so it would hand the packet to its default gateway. It has none, and there is no router, so the ping fails.',
    },
    {
      label: 'Give PC4 the address 192.168.1.200 with mask 255.255.255.128',
      check: { type: 'address', device: 'PC4', network: '192.168.1.128/25', ip: '192.168.1.200' },
      why: "With a /25, PC4's network is 192.168.1.128 to 192.168.1.255. It no longer counts 192.168.1.10 as a neighbour.",
    },
    {
      label: 'Ping PC4 from PC1: it fails too, even though both start with 192.168.1',
      check: {
        type: 'all',
        checks: [
          { type: 'address', device: 'PC4', network: '192.168.1.128/25' },
          { type: 'ping', from: 'PC1', to: 'PC4', expect: false },
        ],
      },
      why: "PC1's /24 says .200 is local, so the request reaches PC4. But PC4's /25 says .10 is on another network, and with no gateway its reply never leaves. Every host on a subnet must use the same mask.",
    },
  ],
  hints: [
    'Double-click PC1, open **Command Prompt** and type `ipconfig 192.168.1.10 255.255.255.0`. Do the same on PC2 with `192.168.1.20`.',
    "Ping from PC1's Command Prompt with `ping 192.168.1.20`. For PC3 use `ipconfig 192.168.2.30 255.255.255.0`.",
    'On PC4 the mask is the point: `ipconfig 192.168.1.200 255.255.255.128`, then `ping 192.168.1.200` from PC1.',
  ],
};
