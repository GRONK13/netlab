// Answer keys for Module 4. Server only: never import this from apps/web.

import type { AnswerKeys } from './grade.ts';

export const deviceSecurityAnswers: AnswerKeys = {
  'secret-vs-password': {
    answer: 2,
    explanation: 'When both exist, IOS ignores enable password and uses the hashed enable secret.',
  },
  'secret-storage': {
    answer: 0,
    explanation: 'enable secret stores a one-way hash: type 5 (MD5), or type 8/9 on newer IOS.',
  },
  type7: {
    answer: 1,
    explanation:
      'Type 7 hides passwords from a glance at the screen, but free tools reverse it in seconds.',
  },
  'login-missing': {
    answer: 3,
    explanation: '`password` only sets the password; `login` is what makes the line ask for it.',
  },
  'vty-purpose': {
    answer: 0,
    explanation:
      'VTY (virtual terminal) lines carry remote sessions: Telnet or SSH over the network.',
  },
  'telnet-risk': {
    answer: 1,
    explanation:
      'Telnet is unencrypted, so anyone capturing the traffic can read the password. SSH encrypts it.',
  },
  'ssh-needs': {
    answer: 3,
    explanation:
      'SSH needs a hostname, a domain name and RSA keys (plus users). A banner is good practice but not required.',
  },
  'banner-wording': {
    answer: 2,
    explanation:
      'Banners should warn that access is for authorized users only, never welcome visitors.',
  },
  'unused-ports': {
    answer: 1,
    explanation:
      'Shut unused ports down so nobody can plug in; real networks also park them in an unused VLAN.',
  },
  'reload-unsaved': {
    answer: 0,
    explanation:
      'A reload loads the startup config. Unsaved changes in the running config are lost.',
  },
  'save-cmd': {
    answer: 2,
    explanation: '`copy running-config startup-config` writes the running config to NVRAM.',
  },
  transport: {
    answer: 3,
    explanation: '`transport input ssh` on the VTY lines accepts SSH and refuses Telnet.',
  },
  'vty-default': { answer: '5', explanation: 'Lines 0, 1, 2, 3 and 4: five remote sessions.' },
  'vty-all': {
    answer: '16',
    explanation: '0 to 15 is 16 lines. Protect all of them, not just 0 to 4.',
  },
  'type-secret': {
    answer: '5',
    explanation: 'Type 5 is an MD5 hash. Newer IOS also offers types 8 and 9.',
  },
  'type-seven': {
    answer: '7',
    explanation: 'service password-encryption produces type 7, a weak reversible scramble.',
  },
  'ssh-port': { answer: '22', explanation: 'SSH listens on TCP port 22.' },
  'telnet-port': { answer: '23', explanation: 'Telnet listens on TCP port 23.' },
  'cmd-console': {
    answer: 'console 0',
    alsoAccept: ['con 0', 'line console 0', 'line con 0'],
    explanation: 'The full command is `line console 0`, often shortened to `line con 0`.',
  },
  'cmd-save-short': {
    answer: 'memory',
    alsoAccept: ['mem', 'write memory', 'wr mem'],
    explanation:
      'The full command is `write memory`; `copy running-config startup-config` does the same.',
  },
  'cmd-encrypt': {
    answer: 'password-encryption',
    alsoAccept: ['service password-encryption'],
    explanation: 'The full command is `service password-encryption`.',
  },
  'cmd-secret': {
    answer: 'secret Class1',
    alsoAccept: ['enable secret Class1'],
    explanation: 'The full command is `enable secret Class1`.',
  },
};
