import type { Lab } from '../types.ts';

const SALES = '192.168.50.0/25';
const HR = '192.168.50.128/25';

/** Module 1 challenge: subnet a /24, then address a router and four PCs. */
export const addressTheOffice: Lab = {
  id: 'address-the-office',
  title: 'Address the Branch Office',
  summary: 'Split one /24 into two subnets, address the router and PCs, and route between them.',
  ccnaDomain: 'Network Fundamentals',
  difficulty: 'Intermediate',
  xp: 150,
  briefing: `The new branch office has been given **192.168.50.0/24**. Sales and HR each get their own subnet, with R1 routing between them.

Your plan:
- Split 192.168.50.0/24 into **two equal subnets**. Sales gets the first, HR the second.
- R1's **Gi0/0** faces Sales (SW1) and **Gi0/1** faces HR (SW2). Each takes the **first usable address** in its subnet, and router interfaces start shut down.
- Each PC gets any usable address in its department's subnet, with **R1 as its default gateway**.

When you're done, every PC should reach every other PC, across the router. Work out the subnets before you type anything.`,
  topology: {
    devices: [
      { id: 'R1', kind: 'router', x: 50, y: 14 },
      { id: 'SW1', kind: 'switch', x: 25, y: 46 },
      { id: 'SW2', kind: 'switch', x: 75, y: 46 },
      { id: 'PC1', kind: 'pc', x: 12, y: 82 },
      { id: 'PC2', kind: 'pc', x: 38, y: 82 },
      { id: 'PC3', kind: 'pc', x: 62, y: 82 },
      { id: 'PC4', kind: 'pc', x: 88, y: 82 },
    ],
    links: [
      {
        a: { device: 'R1', port: 'GigabitEthernet0/0' },
        b: { device: 'SW1', port: 'GigabitEthernet0/1' },
      },
      {
        a: { device: 'R1', port: 'GigabitEthernet0/1' },
        b: { device: 'SW2', port: 'GigabitEthernet0/1' },
      },
      {
        a: { device: 'SW1', port: 'FastEthernet0/1' },
        b: { device: 'PC1', port: 'FastEthernet0' },
      },
      {
        a: { device: 'SW1', port: 'FastEthernet0/2' },
        b: { device: 'PC2', port: 'FastEthernet0' },
      },
      {
        a: { device: 'SW2', port: 'FastEthernet0/1' },
        b: { device: 'PC3', port: 'FastEthernet0' },
      },
      {
        a: { device: 'SW2', port: 'FastEthernet0/2' },
        b: { device: 'PC4', port: 'FastEthernet0' },
      },
    ],
  },
  objectives: [
    {
      label: "R1 Gi0/0 has the first usable address of Sales' subnet",
      check: { type: 'address', device: 'R1', port: 'Gi0/0', network: SALES, ip: '192.168.50.1' },
    },
    {
      label: "R1 Gi0/1 has the first usable address of HR's subnet",
      check: { type: 'address', device: 'R1', port: 'Gi0/1', network: HR, ip: '192.168.50.129' },
    },
    { label: 'R1 Gi0/0 is up', check: { type: 'interfaceUp', device: 'R1', port: 'Gi0/0' } },
    { label: 'R1 Gi0/1 is up', check: { type: 'interfaceUp', device: 'R1', port: 'Gi0/1' } },
    ...(
      [
        ['PC1', 'Sales', SALES, '192.168.50.1'],
        ['PC2', 'Sales', SALES, '192.168.50.1'],
        ['PC3', 'HR', HR, '192.168.50.129'],
        ['PC4', 'HR', HR, '192.168.50.129'],
      ] as const
    ).map(([pc, dept, network, gateway]) => ({
      label: `${pc} has a usable ${dept} address and R1 as its gateway`,
      check: {
        type: 'all' as const,
        checks: [
          { type: 'address' as const, device: pc, network },
          { type: 'gateway' as const, device: pc, ip: gateway },
        ],
      },
    })),
    {
      label: 'PC1 (Sales) can ping PC3 (HR)',
      check: { type: 'ping', from: 'PC1', to: 'PC3', expect: true },
    },
    {
      label: 'PC4 (HR) can ping PC2 (Sales)',
      check: { type: 'ping', from: 'PC4', to: 'PC2', expect: true },
    },
  ],
  hints: [
    'Two equal halves of a /24 are /25s (mask 255.255.255.128): 192.168.50.0 to .127 for Sales and 192.168.50.128 to .255 for HR.',
    'On R1: `interface g0/0`, `ip address 192.168.50.1 255.255.255.128`, `no shutdown`. Then do the same on g0/1 with the first usable address of the HR subnet.',
    "On each PC, Command Prompt: `ipconfig <address> 255.255.255.128 <gateway>`. The gateway is R1's address in that PC's subnet.",
  ],
};
