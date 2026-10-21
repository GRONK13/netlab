import type { Module } from '../types.ts';

export const switchingVlans: Module = {
  id: 'switching-vlans',
  number: 2,
  title: 'Switching and VLANs',
  summary:
    'How a switch forwards frames, and how VLANs split one switch into separate networks with access ports and trunks.',
  ccnaDomain: 'Network Access',
  practice: 'vlan-practice',
  challenge: 'separate-departments',
  lesson: [
    {
      id: 'forwarding',
      title: 'What a switch does',
      body: `A switch connects devices on the same network and moves **frames** between them using **MAC addresses**: 48-bit hardware addresses written in hex, like \`0001.4a2b.3c01\`.

For every frame that arrives, a switch does three things:
1. **Learns:** it notes the frame's *source* MAC address and the port it came in on.
2. **Forwards:** if it already knows which port the *destination* MAC is on, it sends the frame out that port only.
3. **Floods:** if the destination is unknown, or the frame is a broadcast (\`FFFF.FFFF.FFFF\`), it sends it out every other port.

A **hub** does none of this. It repeats every frame out every port, so every device hears everything and only one can talk at a time.`,
    },
    {
      id: 'mac-table',
      title: 'The MAC address table',
      body: `What the switch learns goes into its MAC address table. You can see it with \`show mac address-table\`:

\`\`\`
SW1# show mac address-table
          Mac Address Table
-------------------------------------------
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
   1    0001.4a2b.3c01    DYNAMIC     Fa0/1
   1    0001.4a2b.3c02    DYNAMIC     Fa0/2
\`\`\`

**DYNAMIC** entries were learned from traffic. A Cisco switch forgets an entry that hasn't been used for **300 seconds**, so the table follows devices that move.

> The switch learns from the *source* address only. It never learns where a device is from a frame sent *to* it.`,
    },
    {
      id: 'domains',
      title: 'Collision and broadcast domains',
      body: `Two terms come up again and again on the exam:
- A **collision domain** is a set of devices whose frames can collide. Every switch port is its own collision domain; a hub is one collision domain for all its ports.
- A **broadcast domain** is a set of devices that receive each other's broadcasts. A switch, by default, is one broadcast domain. Routers stop broadcasts, so each router interface is a separate broadcast domain.

| Device | Collision domains | Broadcast domains |
|---|---|---|
| Hub with 4 PCs | 1 | 1 |
| 24-port switch, all ports in VLAN 1 | 24 | 1 |
| Switch with ports in VLANs 1, 10 and 20 | one per port | 3 |
| Router with 2 interfaces | one per interface | 2 |

The VLAN row is the point: one switch, three broadcast domains. That is what VLANs are for.`,
    },
    {
      id: 'vlans',
      title: 'VLANs: one switch, separate networks',
      body: `A **VLAN** (virtual LAN) is a broadcast domain you create inside a switch. Ports in VLAN 10 and ports in VLAN 20 behave as if they were on two different switches: broadcasts, ARP and every other frame stay inside their own VLAN.

That gives you:
- **Separation:** HR's traffic never reaches Sales, even on shared hardware.
- **Smaller broadcast domains:** less flooding on busy networks.
- **Flexibility:** a port's VLAN is configuration, not cabling.

VLAN numbers have ranges you should know:

| VLAN IDs | Meaning |
|---|---|
| 1 | Default VLAN. Every port starts here; it can't be deleted |
| 2–1001 | Normal range, for your VLANs |
| 1002–1005 | Reserved for old Token Ring and FDDI |
| 1006–4094 | Extended range |

> Two PCs in different VLANs can't talk directly, **even if their addresses are in the same subnet**. Traffic between VLANs needs a router. That's Module 3.`,
    },
    {
      id: 'access',
      title: 'Access ports',
      body: `An **access port** belongs to exactly one VLAN and connects an end device such as a PC or printer. Frames on it are ordinary, untagged frames: the PC never knows which VLAN it's in.

\`\`\`
SW1(config)# vlan 10
SW1(config-vlan)# name SALES
SW1(config-vlan)# exit
SW1(config)# interface fa0/1
SW1(config-if)# switchport mode access
SW1(config-if)# switchport access vlan 10
\`\`\`

Use \`interface range fa0/1 - 4\` to configure several ports at once.`,
    },
    {
      id: 'trunks',
      title: 'Trunks and 802.1Q',
      body: `A **trunk** carries traffic for many VLANs over one link, usually between two switches or from a switch to a router. To keep the VLANs apart, the switch adds an **IEEE 802.1Q tag** to each frame:
- The tag is **4 bytes**, inserted into the Ethernet header.
- It holds a **12-bit VLAN ID**, which is why VLANs top out at 4094.
- Frames in the **native VLAN** (VLAN 1 unless you change it) cross the trunk **untagged**. Both ends must agree on the native VLAN.

\`\`\`
SW1(config)# interface g0/1
SW1(config-if)# switchport mode trunk
SW1(config-if)# switchport trunk allowed vlan 10,20
\`\`\`

The **allowed list** limits which VLANs may cross the trunk. Leave a VLAN out and its traffic stops at that link.`,
    },
    {
      id: 'verify',
      title: 'Verify, then try it',
      body: `Four commands answer almost every switching question:

| Command | Shows |
|---|---|
| \`show vlan brief\` | Every VLAN, its name, and its access ports |
| \`show interfaces trunk\` | Trunk ports and the VLANs allowed and active on them |
| \`show interfaces status\` | Each port's state, VLAN (or "trunk"), speed and duplex |
| \`show mac address-table\` | Which MAC addresses were learned on which ports |

Next, the **guided practice** walks you through creating VLANs on one switch and watching which PCs can still talk. Then the **checkpoint quiz**, and finally the **Separate the Departments** challenge.`,
    },
  ],
  quiz: {
    draw: 10,
    pass: 8,
    xp: 75,
    questions: [
      {
        id: 'learn',
        kind: 'choice',
        prompt: 'What does a switch learn from each frame it receives?',
        choices: [
          'The destination MAC address',
          'The source MAC address and the port it came in on',
          "The sender's IP address",
          'The VLAN of the destination',
        ],
      },
      {
        id: 'unknown-unicast',
        kind: 'choice',
        prompt:
          "A switch receives a frame for a MAC address that isn't in its table. What does it do?",
        choices: [
          'Drops the frame',
          'Sends it back out the port it came in on',
          'Floods it out every other port in the same VLAN',
          'Asks the default gateway where to send it',
        ],
      },
      {
        id: 'broadcast',
        kind: 'choice',
        prompt: 'Where does a switch send a broadcast frame (destination FFFF.FFFF.FFFF)?',
        choices: [
          'Out every port in the same VLAN except the one it came in on',
          'Only to the default gateway',
          'Out every port on the switch, in every VLAN',
          'Nowhere: switches drop broadcasts',
        ],
      },
      {
        id: 'hub-vs-switch',
        kind: 'choice',
        prompt: 'What is the main difference between a hub and a switch?',
        choices: [
          'A hub is faster',
          'A switch sends frames only where they need to go; a hub repeats them out every port',
          'A hub understands VLANs',
          'A switch needs an IP address on every port',
        ],
      },
      {
        id: 'vlan-is',
        kind: 'choice',
        prompt: 'What is a VLAN?',
        choices: [
          'A separate broadcast domain on a switch',
          'A wireless network',
          'A type of router interface',
          'An encrypted tunnel between sites',
        ],
      },
      {
        id: 'same-subnet-diff-vlan',
        kind: 'choice',
        prompt:
          'PC1 (VLAN 10) and PC2 (VLAN 20) are on the same switch, with addresses in the same subnet. Can they ping each other?',
        choices: [
          "Yes, they're in the same subnet",
          "Yes, they're on the same switch",
          'Only if a trunk allows both VLANs',
          'No, traffic between VLANs needs a router',
        ],
      },
      {
        id: 'default-vlan',
        kind: 'choice',
        prompt: 'Which VLAN are all switch ports in by default?',
        choices: ['VLAN 0', 'VLAN 1', 'VLAN 10', 'VLAN 1002'],
      },
      {
        id: 'access-port',
        kind: 'choice',
        prompt: 'What does an access port carry?',
        choices: [
          'Untagged frames for one VLAN',
          'Tagged frames for many VLANs',
          'Only management traffic',
          'Frames for VLAN 1 only',
        ],
      },
      {
        id: 'trunk-port',
        kind: 'choice',
        prompt: 'Which kind of port carries traffic for several VLANs between two switches?',
        choices: ['Access port', 'Console port', 'Trunk port', 'Auxiliary port'],
      },
      {
        id: 'native-vlan',
        kind: 'choice',
        prompt: 'How are frames in the native VLAN sent across an 802.1Q trunk?',
        choices: ['With two tags', 'Encrypted', 'They are dropped', 'Untagged'],
      },
      {
        id: 'verify-vlans',
        kind: 'choice',
        prompt: 'Which command lists each VLAN and the access ports in it?',
        choices: [
          'show vlan brief',
          'show ip interface brief',
          'show interfaces trunk',
          'show version',
        ],
      },
      {
        id: 'verify-trunk',
        kind: 'choice',
        prompt: "Which command lists a switch's trunks and the VLANs allowed on them?",
        choices: [
          'show vlan brief',
          'show mac address-table',
          'show interfaces trunk',
          'show running-config',
        ],
      },
      {
        id: 'mac-bits',
        kind: 'input',
        prompt: 'How many bits long is a MAC address?',
        answerType: 'number',
      },
      {
        id: 'tag-bytes',
        kind: 'input',
        prompt: 'How many bytes does an 802.1Q tag add to a frame?',
        answerType: 'number',
      },
      {
        id: 'vid-bits',
        kind: 'input',
        prompt: 'How many bits long is the VLAN ID field in an 802.1Q tag?',
        answerType: 'number',
      },
      {
        id: 'max-vlan',
        kind: 'input',
        prompt: 'What is the highest VLAN ID you can use?',
        answerType: 'number',
      },
      {
        id: 'collision-24',
        kind: 'input',
        prompt: 'A 24-port switch has a device on every port. How many collision domains is that?',
        answerType: 'number',
      },
      {
        id: 'broadcast-1vlan',
        kind: 'input',
        prompt:
          'The same 24-port switch has every port in VLAN 1. How many broadcast domains is that?',
        answerType: 'number',
      },
      {
        id: 'broadcast-3vlans',
        kind: 'input',
        prompt:
          'A switch has ports in VLANs 1, 10 and 20. How many broadcast domains does it have?',
        answerType: 'number',
      },
      {
        id: 'hub-collision',
        kind: 'input',
        prompt: 'Four PCs plug into one hub. How many collision domains is that?',
        answerType: 'number',
      },
      {
        id: 'aging',
        kind: 'input',
        prompt:
          'By default, after how many seconds does a Cisco switch forget an unused MAC table entry?',
        answerType: 'number',
      },
      {
        id: 'cmd-access-vlan',
        kind: 'input',
        prompt: 'Complete the command that puts an access port in VLAN 30: switchport access ____',
        answerType: 'text',
        placeholder: 'the rest of the command',
      },
    ],
  },
};
