import type { Module } from '../types.ts';

export const ipAddressing: Module = {
  id: 'ip-addressing',
  number: 1,
  title: 'IP Addressing and Subnetting',
  summary:
    'Read an IPv4 address in binary, find its network, broadcast and usable range, and size subnets fast.',
  ccnaDomain: 'Network Fundamentals',
  trainer: 'subnetting',
  lesson: [
    {
      id: 'binary',
      title: 'An address is a 32-bit number',
      body: `An IPv4 address like \`192.168.1.130\` is one 32-bit number. We write it as four **octets** of 8 bits each, in decimal, separated by dots. Each octet can be 0 to 255.

Inside an octet, each bit has a value. Add up the values of the bits that are 1:

| Bit | 1st | 2nd | 3rd | 4th | 5th | 6th | 7th | 8th |
|---|---|---|---|---|---|---|---|---|
| Value | 128 | 64 | 32 | 16 | 8 | 4 | 2 | 1 |

So \`130\` is 128 + 2, which is \`10000010\`, and \`172\` is 128 + 32 + 8 + 4, which is \`10101100\`.

Type any address below to see its bits. Leave the prefix alone for now; the next section explains it.

::: subnet-explorer 192.168.1.130/26`,
    },
    {
      id: 'prefix',
      title: 'Network bits and host bits',
      body: `Every address has two parts. The **network** part says which network the device is on; the **host** part says which device it is on that network.

The **prefix length** says how many of the 32 bits, counting from the left, are network bits. In \`192.168.1.130/24\`, the first 24 bits (\`192.168.1\`) are the network and the last 8 (\`130\`) are the host.

A **subnet mask** says the same thing written like an address: network bits are 1, host bits are 0. So /24 is \`255.255.255.0\`. When a prefix doesn't end on an octet boundary, the mask octet is the sum of the leftmost bit values:

| Bits in the octet | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Mask octet | 128 | 192 | 224 | 240 | 248 | 252 | 254 | 255 |

/26 is 24 + 2 bits, so its mask is \`255.255.255.192\`. /20 is 16 + 4, so \`255.255.240.0\`.

> Two devices are on the same network when their network bits are identical. That's the check a PC makes before every packet it sends.`,
    },
    {
      id: 'ranges',
      title: 'Network, broadcast and usable hosts',
      body: `Inside every subnet, two addresses are reserved:
- The **network address** has all host bits set to 0. It names the subnet and can't be given to a device.
- The **broadcast address** has all host bits set to 1. A packet sent there reaches every device on the subnet.

Everything in between is **usable**. With *h* host bits there are 2^h − 2 usable addresses.

### Worked example: 192.168.1.130/26
- /26 leaves 6 host bits, so each subnet has 64 addresses and 62 usable hosts.
- The /26 subnets of 192.168.1.0 start at .0, .64, .128 and .192. 130 falls in the one starting at .128.
- Network \`192.168.1.128\`, broadcast \`192.168.1.191\`, usable \`192.168.1.129\` to \`192.168.1.190\`.

> Two exceptions you'll meet: a /31 on a router-to-router link uses both of its addresses (RFC 3021), and a /32 names exactly one host.`,
    },
    {
      id: 'block-size',
      title: 'Subnetting fast: the block size',
      body: `You don't need to write out binary every time. Use the **block size**:
1. Find the interesting octet: the one where the mask is neither 255 nor 0.
2. Block size = 256 − that mask octet.
3. Subnets start at multiples of the block size in that octet.
4. The network is the multiple at or below the address. The broadcast is one less than the next multiple.

### Worked example: 172.16.45.200/20
- /20 is \`255.255.240.0\`. The interesting octet is the third, and 256 − 240 = **16**.
- Multiples of 16: 0, 16, 32, 48… 45 falls between 32 and 48.
- Network \`172.16.32.0\`, broadcast \`172.16.47.255\`, and 12 host bits give 2^12 − 2 = **4094** usable hosts.

### Sizing a subnet for N hosts
Find the smallest *h* where 2^h − 2 ≥ N. The prefix is 32 − *h*. For 50 hosts, 2^6 − 2 = 62 is enough, so use a **/26**.

### Splitting a /24
Each bit you borrow from the host part doubles the number of subnets and roughly halves their size:

| Prefix | Mask | Block | Subnets in a /24 | Usable hosts each |
|---|---|---|---|---|
| /24 | 255.255.255.0 | 256 | 1 | 254 |
| /25 | 255.255.255.128 | 128 | 2 | 126 |
| /26 | 255.255.255.192 | 64 | 4 | 62 |
| /27 | 255.255.255.224 | 32 | 8 | 30 |
| /28 | 255.255.255.240 | 16 | 16 | 14 |
| /29 | 255.255.255.248 | 8 | 32 | 6 |
| /30 | 255.255.255.252 | 4 | 64 | 2 |

::: subnet-explorer 172.16.45.200/20`,
    },
    {
      id: 'gateway',
      title: 'The default gateway',
      body: `Before sending a packet, a PC compares the destination's network bits with its own:
- **Same subnet:** it delivers the packet directly, using ARP to find the destination's MAC address.
- **Different subnet:** it sends the packet to its **default gateway**, a router interface on its own subnet, and the router forwards it.

That's why the gateway must be an address inside the PC's own subnet. A PC with no gateway can still reach its neighbours, but nothing beyond them.

> When a ping fails, check three things first: the address, the mask and the gateway. A mask that doesn't match the rest of the subnet is the most common mistake.`,
    },
    {
      id: 'special',
      title: 'Addresses with special jobs',
      body: `Some ranges are set aside, and the CCNA expects you to recognise them:

| Range | Used for |
|---|---|
| \`10.0.0.0/8\` | Private (RFC 1918) |
| \`172.16.0.0/12\` (172.16.0.0 to 172.31.255.255) | Private (RFC 1918) |
| \`192.168.0.0/16\` | Private (RFC 1918) |
| \`127.0.0.0/8\` | Loopback: \`127.0.0.1\` tests the device's own network stack |
| \`169.254.0.0/16\` | Link-local (APIPA): a PC picks one when it can't reach a DHCP server |

Private addresses are used inside organisations and aren't routed on the internet; NAT translates them on the way out.

### Classes, briefly
Before prefixes, the first octet set the default mask: **Class A** 1–126 (/8), **Class B** 128–191 (/16), **Class C** 192–223 (/24). Networks no longer work this way, but exam questions still use the terms.`,
    },
    {
      id: 'try-it',
      title: 'Try it in NetLab',
      body: `On a PC, open **Command Prompt** and set an address, mask and gateway in one line, or use the **IP Configuration** app:

\`\`\`
C:\\> ipconfig 192.168.1.10 255.255.255.0 192.168.1.1
\`\`\`

On a router, addresses go on interfaces, and router interfaces start shut down:

\`\`\`
R1(config)# interface g0/0
R1(config-if)# ip address 192.168.1.1 255.255.255.0
R1(config-if)# no shutdown
\`\`\`

Check your work with \`show ip interface brief\` on the router and \`ping\` from either side.

Next, drill the math in the **subnetting trainer**, then take the **checkpoint quiz**.`,
    },
  ],
  quiz: {
    draw: 10,
    pass: 8,
    xp: 75,
    questions: [
      {
        id: 'bits',
        kind: 'choice',
        prompt: 'How many bits are in an IPv4 address?',
        choices: ['8', '16', '32', '128'],
      },
      {
        id: 'mask-27',
        kind: 'choice',
        prompt: 'Which subnet mask matches /27?',
        choices: ['255.255.255.224', '255.255.255.192', '255.255.255.240', '255.255.224.0'],
      },
      {
        id: 'private',
        kind: 'choice',
        prompt: 'Which of these is a private (RFC 1918) address?',
        choices: ['172.32.10.1', '192.169.1.1', '10.200.5.9', '11.0.0.1'],
      },
      {
        id: 'apipa',
        kind: 'choice',
        prompt: 'A Windows PC shows the address 169.254.33.7. What most likely happened?',
        choices: [
          "It couldn't reach a DHCP server",
          'It got its address from a DHCP server',
          'Its default gateway is wrong',
          "It's using IPv6",
        ],
      },
      {
        id: 'loopback',
        kind: 'choice',
        prompt: 'What is 127.0.0.1 used for?',
        choices: [
          'Reaching the default gateway',
          'Broadcasting to the local subnet',
          'Finding a DHCP server',
          "Testing the device's own network stack",
        ],
      },
      {
        id: 'not-assignable',
        kind: 'choice',
        prompt: "Which address can't be assigned to a host in 192.168.10.0/24?",
        choices: ['192.168.10.1', '192.168.10.100', '192.168.10.254', '192.168.10.255'],
      },
      {
        id: 'bad-gateway',
        kind: 'choice',
        prompt: "PC1 is 10.1.1.10/24 with default gateway 10.1.2.1. What's wrong?",
        choices: [
          'Nothing, this is a valid setup',
          "The gateway isn't in PC1's subnet",
          'The mask is too long for a 10.x address',
          "10.x addresses can't use a gateway",
        ],
      },
      {
        id: 'same-subnet',
        kind: 'choice',
        prompt:
          'Two PCs, 192.168.1.50/26 and 192.168.1.70/26, are on the same switch with no router. Can they ping each other?',
        choices: [
          'Yes, they share 192.168.1',
          'Yes, because they use the same mask',
          'Only if one of them has a gateway set',
          "No, they're in different /26 subnets",
        ],
      },
      {
        id: 'p2p',
        kind: 'choice',
        prompt:
          'Which prefix gives exactly 2 usable addresses plus a network and broadcast address, the classic choice for a router-to-router link?',
        choices: ['/28', '/29', '/30', '/32'],
      },
      {
        id: 'host-part',
        kind: 'choice',
        prompt: 'In 172.16.45.200/16, which part is the host portion?',
        choices: ['45.200', '172.16', '200', '16.45'],
      },
      {
        id: 'off-subnet',
        kind: 'choice',
        prompt: 'What does a PC do with a packet for an address outside its own subnet?',
        choices: [
          'Broadcasts it to the subnet',
          'Sends it to its default gateway',
          'Drops it',
          'Sends it to its DNS server',
        ],
      },
      {
        id: 'class-b',
        kind: 'choice',
        prompt: 'Under the old classful rules, which class is 130.10.0.0?',
        choices: ['Class A', 'Class B', 'Class C', 'Class D'],
      },
      {
        id: 'net-27',
        kind: 'input',
        prompt: 'Network address of 192.168.5.77/27?',
        answerType: 'ip',
      },
      {
        id: 'bcast-29',
        kind: 'input',
        prompt: 'Broadcast address of 10.10.10.10/29?',
        answerType: 'ip',
      },
      {
        id: 'hosts-23',
        kind: 'input',
        prompt: 'How many usable hosts does a /23 have?',
        answerType: 'number',
      },
      {
        id: 'last-22',
        kind: 'input',
        prompt: 'Last usable host in 172.16.18.0/22?',
        answerType: 'ip',
      },
      {
        id: 'fit-100',
        kind: 'input',
        prompt: 'Longest prefix (smallest subnet) that fits 100 hosts?',
        answerType: 'number',
        placeholder: 'e.g. 24',
      },
      {
        id: 'count-26',
        kind: 'input',
        prompt: 'How many /26 subnets fit in one /24?',
        answerType: 'number',
      },
      {
        id: 'prefix-248',
        kind: 'input',
        prompt: 'Write 255.255.248.0 as a prefix length.',
        answerType: 'number',
      },
      {
        id: 'first-25',
        kind: 'input',
        prompt: 'First usable host in 192.168.100.200/25?',
        answerType: 'ip',
      },
      {
        id: 'binary-172',
        kind: 'input',
        prompt: 'Write 172 as an 8-bit binary number.',
        answerType: 'text',
        placeholder: '8 bits',
      },
      {
        id: 'net-17',
        kind: 'input',
        prompt: 'Which subnet does 10.0.130.5/17 belong to? Give its network address.',
        answerType: 'ip',
      },
    ],
  },
};
