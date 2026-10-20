import type { Lab } from '../types.ts';

export const switchBasics: Lab = {
  id: 'switch-basics',
  title: 'Switch Basics',
  summary: 'Name a new switch, lock it down with passwords and a banner, and save your work.',
  ccnaDomain: 'Security Fundamentals',
  difficulty: 'Beginner',
  xp: 100,
  briefing: `A new switch just arrived for the office. Before it goes on the network, secure it.

Click **SW1** in the topology to open its console. Use these values:
- Hostname: \`SW1\`
- Enable secret: \`class\`
- Console password: \`cisco\` (with login)
- VTY lines 0 to 4 password: \`cisco\` (with login)
- A message-of-the-day banner that contains the word \`Authorized\`

Then encrypt the plain-text passwords and save the configuration so it survives a reboot.`,
  topology: {
    devices: [
      { id: 'SW1', kind: 'switch', x: 50, y: 30 },
      { id: 'PC1', kind: 'pc', x: 50, y: 80, pc: { ip: '192.168.1.10', mask: '255.255.255.0' } },
    ],
    links: [{ a: { device: 'SW1', port: 'FastEthernet0/1' }, b: { device: 'PC1', port: 'FastEthernet0' } }],
  },
  objectives: [
    { label: 'Hostname is SW1', check: { type: 'hostname', device: 'SW1', value: 'SW1' } },
    { label: 'Enable secret is set to class', check: { type: 'enableSecret', device: 'SW1', value: 'class' } },
    {
      label: 'Console line uses password cisco and login',
      check: { type: 'linePassword', device: 'SW1', line: 'con', value: 'cisco' },
    },
    {
      label: 'VTY lines 0-4 use password cisco and login',
      check: { type: 'linePassword', device: 'SW1', line: 'vty', value: 'cisco' },
    },
    { label: 'MOTD banner mentions "Authorized"', check: { type: 'bannerContains', device: 'SW1', text: 'Authorized' } },
    { label: 'Plain-text passwords are encrypted', check: { type: 'passwordEncryption', device: 'SW1' } },
    { label: 'Running config is saved to startup config', check: { type: 'configSaved', device: 'SW1' } },
  ],
  hints: [
    'Most of these settings live in global configuration mode: `enable`, then `configure terminal`.',
    'Line passwords are set inside the line: `line console 0`, then `password cisco` and `login`. Do the same under `line vty 0 4`.',
    'Use `service password-encryption`, then save from privileged mode with `copy running-config startup-config` (or `write`). Save last, after every other change.',
  ],
};
