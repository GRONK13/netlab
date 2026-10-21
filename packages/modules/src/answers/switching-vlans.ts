// Answer keys for Module 2. Server only: never import this from apps/web.

import type { AnswerKeys } from './grade.ts';

export const switchingVlansAnswers: AnswerKeys = {
  learn: {
    answer: 1,
    explanation:
      'Switches learn from the source address: "this MAC lives on this port". They never learn from destinations.',
  },
  'unknown-unicast': {
    answer: 2,
    explanation:
      'An unknown destination is flooded out every other port in the VLAN. When the reply comes back, the switch learns where it lives.',
  },
  broadcast: {
    answer: 0,
    explanation:
      'Broadcasts go everywhere in their own VLAN, but never into other VLANs. That is what makes a VLAN a broadcast domain.',
  },
  'hub-vs-switch': {
    answer: 1,
    explanation:
      'A hub repeats everything out every port. A switch learns MAC addresses and forwards each frame only where it needs to go.',
  },
  'vlan-is': { answer: 0, explanation: 'A VLAN is a broadcast domain created inside a switch.' },
  'same-subnet-diff-vlan': {
    answer: 3,
    explanation:
      'Different VLANs are different broadcast domains, so ARP never crosses between them. Only a router can connect VLANs.',
  },
  'default-vlan': {
    answer: 1,
    explanation: 'Every port starts in VLAN 1, and VLAN 1 cannot be deleted.',
  },
  'access-port': {
    answer: 0,
    explanation:
      'An access port belongs to one VLAN and carries ordinary untagged frames for an end device.',
  },
  'trunk-port': {
    answer: 2,
    explanation: 'Trunks carry many VLANs over one link, tagging frames with 802.1Q.',
  },
  'native-vlan': {
    answer: 3,
    explanation:
      'Native VLAN frames cross an 802.1Q trunk without a tag. Both ends must agree on which VLAN is native.',
  },
  'verify-vlans': {
    answer: 0,
    explanation: '`show vlan brief` lists each VLAN, its name, and the access ports in it.',
  },
  'verify-trunk': {
    answer: 2,
    explanation: '`show interfaces trunk` lists trunk ports with their allowed and active VLANs.',
  },
  'mac-bits': { answer: '48', explanation: 'MAC addresses are 48 bits, written as 12 hex digits.' },
  'tag-bytes': {
    answer: '4',
    explanation: 'An 802.1Q tag is 4 bytes, inserted into the Ethernet header.',
  },
  'vid-bits': {
    answer: '12',
    explanation: 'The VLAN ID is 12 bits: 2^12 = 4096 values, with 0 and 4095 reserved.',
  },
  'max-vlan': {
    answer: '4094',
    explanation: '12 bits give 0–4095; 0 and 4095 are reserved, so 4094 is the highest.',
  },
  'collision-24': { answer: '24', explanation: 'Every switch port is its own collision domain.' },
  'broadcast-1vlan': {
    answer: '1',
    explanation: 'One VLAN means one broadcast domain, however many ports.',
  },
  'broadcast-3vlans': {
    answer: '3',
    explanation: 'Each VLAN is its own broadcast domain: 3 VLANs, 3 broadcast domains.',
  },
  'hub-collision': {
    answer: '1',
    explanation: 'A hub repeats everything, so all its ports share one collision domain.',
  },
  aging: {
    answer: '300',
    explanation: 'Cisco switches age out unused MAC table entries after 300 seconds by default.',
  },
  'cmd-access-vlan': {
    answer: 'vlan 30',
    explanation: 'The full command is `switchport access vlan 30`.',
  },
};
