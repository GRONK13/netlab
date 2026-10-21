// Answer keys for Module 3. Server only: never import this from apps/web.

import type { AnswerKeys } from './grade.ts';

export const interVlanRoutingAnswers: AnswerKeys = {
  'why-router': {
    answer: 0,
    explanation:
      'Each VLAN is a separate broadcast domain, usually with its own subnet, so traffic between them must be routed.',
  },
  'roas-is': {
    answer: 1,
    explanation:
      'Router-on-a-stick uses one physical link as a trunk, with a subinterface per VLAN on the router.',
  },
  'subif-cmd': {
    answer: 2,
    explanation:
      '`encapsulation dot1Q 20` tells the subinterface to send and receive frames tagged VLAN 20.',
  },
  order: {
    answer: 3,
    explanation:
      'IOS refuses an IP address on a subinterface until `encapsulation dot1Q` sets its VLAN.',
  },
  'switch-port': {
    answer: 3,
    explanation:
      'The link to the router carries several VLANs, so the switch port must be a trunk.',
  },
  gateway: {
    answer: 0,
    explanation:
      "Each VLAN's PCs use their own subinterface's address, which sits in their subnet, as the gateway.",
  },
  'physical-down': {
    answer: 1,
    explanation:
      'Subinterfaces follow the physical interface. Router interfaces start shut down, so `no shutdown` on g0/0.',
  },
  'allowed-missing': {
    answer: 2,
    explanation: "If VLAN 30 isn't in the trunk's allowed list, its frames never reach the router.",
  },
  'l3-switch': {
    answer: 3,
    explanation:
      'A layer 3 (multilayer) switch routes between VLANs internally, using an SVI per VLAN.',
  },
  'legacy-drawback': {
    answer: 1,
    explanation:
      'One port per VLAN means one router interface and one cable per VLAN, which runs out fast.',
  },
  'show-cmd': {
    answer: 2,
    explanation:
      '`show ip interface brief` lists every interface and subinterface with its address and status.',
  },
  'connected-route': {
    answer: 0,
    explanation:
      'An interface with an address that is up adds its network as a connected route automatically.',
  },
  'subif-name': {
    answer: 'g0/0.30',
    alsoAccept: ['gi0/0.30', 'gigabitethernet0/0.30'],
    explanation:
      'Subinterfaces are the physical name plus a dot and a number. Matching the VLAN, g0/0.30, is the convention.',
  },
  'roas-ports': {
    answer: '1',
    explanation: 'Router-on-a-stick routes every VLAN over one physical port.',
  },
  'legacy-ports': { answer: '5', explanation: 'One port per VLAN: 5 VLANs need 5 router ports.' },
  'trunk-crossings': {
    answer: '2',
    explanation:
      'Up to the router tagged with the source VLAN, then back down tagged with the destination VLAN.',
  },
  'gateway-ip': {
    answer: '192.168.20.1',
    explanation: 'The first usable address in 192.168.20.0/24 is .1.',
  },
  'first-usable-26': {
    answer: '10.0.30.65',
    explanation: '10.0.30.64/26 is the network address, so the first usable is .65.',
  },
  'encap-vlan': {
    answer: '40',
    explanation: 'The encapsulation number is the VLAN ID: `encapsulation dot1Q 40`.',
  },
  'subnets-needed': {
    answer: '3',
    explanation: 'One subnet per VLAN: three VLANs, three subnets.',
  },
  'broadcast-domains': {
    answer: '2',
    explanation: 'Each VLAN is a broadcast domain, and the router keeps them apart: 2.',
  },
  'cmd-encap': {
    answer: 'dot1Q 10',
    alsoAccept: ['encapsulation dot1Q 10'],
    explanation: 'The full command is `encapsulation dot1Q 10`.',
  },
};
