import type { Lab } from '../types.ts';

const unused = [20, 21, 22, 23, 24];

/** Guided practice for Module 4: secure a switch one layer at a time. */
export const securityPractice: Lab = {
  id: 'security-practice',
  title: 'Lock It Down',
  summary:
    'Secure a new switch step by step: enable secret, console login, encryption, unused ports, save.',
  ccnaDomain: 'Security Fundamentals',
  difficulty: 'Beginner',
  xp: 50,
  guided: true,
  briefing: `SW1 is brand new: no passwords, every port live, nothing saved. Anyone who plugs into it, or into its console, gets full control.

Double-click **SW1** to open its console, then \`enable\` and \`configure terminal\`. Work through the steps; each one explains itself once you've done it.

Passwords are case-sensitive. Use exactly \`Class1\` and \`Cisco1\`.`,
  topology: {
    devices: [
      { id: 'SW1', kind: 'switch', x: 50, y: 30 },
      { id: 'PC1', kind: 'pc', x: 50, y: 80, pc: { ip: '192.168.1.10', mask: '255.255.255.0' } },
    ],
    links: [
      {
        a: { device: 'SW1', port: 'FastEthernet0/1' },
        b: { device: 'PC1', port: 'FastEthernet0' },
      },
    ],
  },
  objectives: [
    {
      label: 'Set the enable secret to Class1',
      check: { type: 'enableSecret', device: 'SW1', value: 'Class1' },
      why: 'Privileged EXEC (the # prompt) can change everything, so it gets its own password. `enable secret` stores it as a one-way hash: `show running-config` shows `enable secret 5` and scrambled text.',
    },
    {
      label: 'Give the console the password Cisco1, and turn on login',
      check: { type: 'linePassword', device: 'SW1', line: 'con', value: 'Cisco1' },
      why: '`password` sets it and `login` makes the line ask for it. Try it: `end`, `logout`, then Enter. The console now wants Cisco1 before it lets you in.',
    },
    {
      label: 'Encrypt the plain-text passwords',
      check: { type: 'passwordEncryption', device: 'SW1' },
      why: 'The console password was stored in plain text. `service password-encryption` turns it into type 7, which hides it from a glance but is easy to reverse. That is why the enable password uses a secret.',
    },
    {
      label: 'Shut down the unused ports Fa0/20 to Fa0/24',
      check: {
        type: 'all',
        checks: unused.map((n) => ({ type: 'shutdown' as const, device: 'SW1', port: `Fa0/${n}` })),
      },
      why: 'An unused port that is up is an open door: anyone can walk up and plug in. `interface range fa0/20 - 24` and `shutdown` closed five at once.',
    },
    {
      label: 'Save the configuration',
      check: { type: 'configSaved', device: 'SW1' },
      why: 'Until now everything lived in the running config, in RAM. Saving copied it to the startup config in NVRAM, so it survives a reload or power cut.',
    },
  ],
  hints: [
    '`enable`, `configure terminal`, then `enable secret Class1`.',
    '`line console 0`, `password Cisco1`, `login`, `exit`. Then `service password-encryption`.',
    '`interface range fa0/20 - 24`, `shutdown`, `end`, then `copy running-config startup-config` and press Enter to accept the filename.',
  ],
};
