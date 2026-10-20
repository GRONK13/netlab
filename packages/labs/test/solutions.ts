// Reference solutions. Kept under test/ so they never ship in the web bundle.

import type { LogEntry } from '@netlab/sim';

const on = (device: string, lines: string[]): LogEntry[] => lines.map((line) => ({ device, line }));

export const SOLUTIONS: Record<string, LogEntry[]> = {
  'switch-basics': on('SW1', [
    'en',
    'conf t',
    'hostname SW1',
    'enable secret class',
    'line con 0',
    'password cisco',
    'login',
    'line vty 0 4',
    'password cisco',
    'login',
    'exit',
    'banner motd #Authorized access only#',
    'service password-encryption',
    'end',
    'copy run start',
    '',
  ]),
  'separate-departments': on('SW1', [
    'enable',
    'configure terminal',
    'vlan 10',
    'name SALES',
    'vlan 20',
    'name HR',
    'exit',
    'interface range fa0/1 - 2',
    'switchport mode access',
    'switchport access vlan 10',
    'interface range fa0/3 - 4',
    'switchport mode access',
    'switchport access vlan 20',
    'end',
  ]),
  'router-on-a-stick': [
    ...on('SW1', ['en', 'conf t', 'int g0/1', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20', 'end']),
    ...on('R1', [
      'en',
      'conf t',
      'int g0/0',
      'no shutdown',
      'int g0/0.10',
      'encapsulation dot1Q 10',
      'ip address 192.168.10.1 255.255.255.0',
      'int g0/0.20',
      'encapsulation dot1Q 20',
      'ip address 192.168.20.1 255.255.255.0',
      'end',
    ]),
  ],
};
