// Answer keys for Module 1. Server only: never import this from apps/web.

import type { AnswerKeys } from './grade.ts';

export const ipAddressingAnswers: AnswerKeys = {
  bits: { answer: 2, explanation: 'Four octets of 8 bits each: 32 bits.' },
  'mask-27': {
    answer: 0,
    explanation: '/27 is 24 + 3 bits. The fourth octet is 128 + 64 + 32 = 224.',
  },
  private: {
    answer: 2,
    explanation:
      "10.0.0.0/8 is private. 172.32.x.x is just outside 172.16–172.31, 192.169.x.x isn't 192.168, and 11.x.x.x is public.",
  },
  apipa: {
    answer: 0,
    explanation:
      '169.254.0.0/16 is link-local (APIPA). Windows assigns itself one when no DHCP server answers.',
  },
  loopback: {
    answer: 3,
    explanation: '127.0.0.0/8 is loopback: traffic to it never leaves the device.',
  },
  'not-assignable': {
    answer: 3,
    explanation:
      'In a /24 the last address, .255, is the broadcast address. .0 is the network address.',
  },
  'bad-gateway': {
    answer: 1,
    explanation:
      "PC1's subnet is 10.1.1.0/24. The gateway must be inside it, but 10.1.2.1 is on another subnet.",
  },
  'same-subnet': {
    answer: 3,
    explanation:
      'The /26 blocks are .0–.63 and .64–.127. .50 and .70 are in different subnets, so they need a router.',
  },
  p2p: { answer: 2, explanation: 'A /30 has 4 addresses: network, 2 usable, broadcast.' },
  'host-part': {
    answer: 0,
    explanation: '/16 makes the first two octets the network; 45.200 is the host part.',
  },
  'off-subnet': {
    answer: 1,
    explanation: 'Anything outside the local subnet goes to the default gateway.',
  },
  'class-b': {
    answer: 1,
    explanation: 'Class B covered first octets 128 to 191, with a default /16 mask.',
  },
  'net-27': {
    answer: '192.168.5.64',
    explanation: '/27 has a block size of 32: .64 to .95 contains .77.',
  },
  'bcast-29': {
    answer: '10.10.10.15',
    explanation: '/29 has a block size of 8: .8 to .15 contains .10.',
  },
  'hosts-23': { answer: '510', explanation: '/23 leaves 9 host bits: 2^9 − 2 = 510.' },
  'last-22': {
    answer: '172.16.19.254',
    explanation:
      '/22 has a block size of 4 in the third octet: 16 to 19. The broadcast is 172.16.19.255.',
  },
  'fit-100': {
    answer: '25',
    explanation: '2^7 − 2 = 126 is the smallest that fits 100, so 7 host bits: /25.',
  },
  'count-26': {
    answer: '4',
    explanation: 'Borrowing 2 bits from a /24 gives 2^2 = 4 subnets of 64 addresses.',
  },
  'prefix-248': { answer: '21', explanation: '8 + 8 + 5 (248 is five 1-bits: 11111000) = 21.' },
  'first-25': {
    answer: '192.168.100.129',
    explanation: '/25 splits at .128: .200 is in .128–.255, so the first host is .129.',
  },
  'binary-172': {
    answer: '10101100',
    explanation: '172 = 128 + 32 + 8 + 4, so the bits are 1 0 1 0 1 1 0 0.',
  },
  'net-17': {
    answer: '10.0.128.0',
    explanation: '/17 has a block size of 128 in the third octet: 130 falls in 128–255.',
  },
};
