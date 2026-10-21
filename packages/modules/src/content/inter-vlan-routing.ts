import type { Module } from '../types.ts';

export const interVlanRouting: Module = {
  id: 'inter-vlan-routing',
  number: 3,
  title: 'Inter-VLAN Routing',
  summary:
    'Connect VLANs through a router: one port per VLAN, then router-on-a-stick with a trunk and dot1Q subinterfaces.',
  ccnaDomain: 'IP Connectivity',
  practice: 'routing-practice',
  challenge: 'router-on-a-stick',
  lesson: [
    {
      id: 'why',
      title: 'Why VLANs need a router',
      body: `Each VLAN is its own broadcast domain, and in practice its own subnet: VLAN 10 might be \`192.168.10.0/24\` and VLAN 20 \`192.168.20.0/24\`. A PC in VLAN 10 that wants to reach VLAN 20 sees a different network, so it sends the packet to its **default gateway**. Something must own that gateway address and forward between the subnets. That something is a router.

There are three ways to give each VLAN a gateway:

| Method | How it works | Scales? |
|---|---|---|
| One router port per VLAN | Each VLAN has an access port cabled to its own router interface | Poorly: a port and a cable per VLAN |
| Router on a stick | One trunk to the router, one **subinterface** per VLAN | Well, but every routed packet shares one link |
| Layer 3 switch | The switch routes itself, with an **SVI** (virtual interface) per VLAN | Best; common in real networks, not in NetLab yet |`,
    },
    {
      id: 'one-port',
      title: 'One router port per VLAN',
      body: `The simplest design: plug a router interface into an access port in each VLAN, and give each interface an address in that VLAN's subnet. That address is the gateway for the VLAN's PCs.

\`\`\`
R1(config)# interface g0/0
R1(config-if)# ip address 192.168.10.1 255.255.255.0
R1(config-if)# no shutdown
R1(config-if)# interface g0/1
R1(config-if)# ip address 192.168.20.1 255.255.255.0
R1(config-if)# no shutdown
\`\`\`

As soon as both interfaces are up, R1 knows both networks as **connected** routes, with no extra configuration. On real IOS, \`show ip route\` lists them with a **C** (NetLab doesn't simulate that command yet).

> It works, but ten VLANs would need ten router ports and ten cables. The guided practice builds this design so you can see routing work before the shortcut.`,
    },
    {
      id: 'stick',
      title: 'Router on a stick',
      body: `Router on a stick carries every VLAN to the router over **one trunk**. The router splits its single physical interface into **subinterfaces**, one per VLAN, named like \`g0/0.10\`. Each subinterface:
- is told which VLAN tag it handles, with \`encapsulation dot1Q <vlan>\`
- gets an address in that VLAN's subnet: the gateway for its PCs

\`\`\`
R1(config)# interface g0/0
R1(config-if)# no shutdown
R1(config-if)# interface g0/0.10
R1(config-subif)# encapsulation dot1Q 10
R1(config-subif)# ip address 192.168.10.1 255.255.255.0
R1(config-subif)# interface g0/0.20
R1(config-subif)# encapsulation dot1Q 20
R1(config-subif)# ip address 192.168.20.1 255.255.255.0
\`\`\`

> Order matters: IOS refuses an IP address on a subinterface until its \`encapsulation dot1Q\` is set. And subinterfaces only come up when the physical interface does, so \`no shutdown\` goes on \`g0/0\` itself.

The subinterface number doesn't have to match the VLAN, but matching them (\`g0/0.10\` for VLAN 10) saves everyone confusion.`,
    },
    {
      id: 'switch-side',
      title: 'The switch side',
      body: `The switch port facing the router must be a **trunk**, so frames keep their VLAN tags on the way to the router:

\`\`\`
SW1(config)# interface g0/1
SW1(config-if)# switchport mode trunk
SW1(config-if)# switchport trunk allowed vlan 10,20
\`\`\`

The PCs stay on ordinary access ports in their VLANs, and use the router subinterface for their VLAN as their default gateway.

> Every VLAN you route must be on the trunk's allowed list. Leave one out and that VLAN alone loses its gateway, while the others keep working.`,
    },
    {
      id: 'packet',
      title: 'Follow a packet',
      body: `PC1 (VLAN 10, \`192.168.10.10\`) pings PC2 (VLAN 20, \`192.168.20.10\`) through router on a stick:
1. PC1 sees \`192.168.20.10\` is outside its subnet, so it sends the frame to its gateway, \`192.168.10.1\`.
2. SW1 receives it on PC1's access port in VLAN 10 and sends it up the trunk **tagged 10**.
3. R1 receives tag 10 on \`g0/0.10\`, removes the tag, and finds \`192.168.20.0/24\` as a connected network on \`g0/0.20\`.
4. R1 sends it back down the same cable **tagged 20**.
5. SW1 delivers it, untagged, to PC2's access port in VLAN 20. The reply makes the same trip in reverse.

So each routed packet crosses the trunk **twice**: once up to the router, once back down.`,
    },
    {
      id: 'troubleshoot',
      title: "When it doesn't work",
      body: `Check in this order, and most problems show up in the first three:
1. **Is the physical interface up?** \`no shutdown\` on \`g0/0\`. Check with \`show ip interface brief\`.
2. **Is the switch port a trunk that allows every routed VLAN?** Check with \`show interfaces trunk\`.
3. **Does each subinterface's encapsulation match its VLAN?** A subinterface with \`encapsulation dot1Q 20\` can't serve VLAN 10.
4. **Is each subinterface in the right subnet, and is it the PCs' gateway?** Compare the router's addresses with each PC's \`ipconfig\`.
5. **Are the PCs' access ports in the right VLANs?** Check with \`show vlan brief\`.

Next: the guided practice routes two VLANs the one-port-per-VLAN way. Then the checkpoint quiz, and the **Router on a Stick** challenge.`,
    },
  ],
  quiz: {
    draw: 10,
    pass: 8,
    xp: 75,
    questions: [
      {
        id: 'why-router',
        kind: 'choice',
        prompt: 'Why do PCs in different VLANs need a router to reach each other?',
        choices: [
          'Each VLAN is its own broadcast domain and subnet',
          "Switches can't forward IP packets at all",
          'VLANs block all traffic by default',
          'A trunk can only carry one VLAN',
        ],
      },
      {
        id: 'roas-is',
        kind: 'choice',
        prompt: 'What is router-on-a-stick?',
        choices: [
          'A router with one physical interface per VLAN',
          'One router interface split into subinterfaces, one per VLAN, over a trunk',
          'A switch that routes using virtual interfaces',
          'A router managed through its console cable',
        ],
      },
      {
        id: 'subif-cmd',
        kind: 'choice',
        prompt: "Which command makes a subinterface handle VLAN 20's traffic?",
        choices: [
          'switchport access vlan 20',
          'vlan 20',
          'encapsulation dot1Q 20',
          'ip address vlan 20',
        ],
      },
      {
        id: 'order',
        kind: 'choice',
        prompt: 'On a subinterface, what must be configured before the IP address?',
        choices: [
          'A description',
          'no shutdown',
          'The interface speed',
          'The encapsulation (dot1Q and the VLAN)',
        ],
      },
      {
        id: 'switch-port',
        kind: 'choice',
        prompt: 'In router-on-a-stick, the switch port facing the router must be...',
        choices: ['An access port in VLAN 1', 'Shut down', 'In the native VLAN only', 'A trunk'],
      },
      {
        id: 'gateway',
        kind: 'choice',
        prompt: 'What should a PC in VLAN 10 use as its default gateway?',
        choices: [
          "The router subinterface's address for VLAN 10",
          "The switch's management address",
          'Any address in VLAN 20',
          'The broadcast address of its subnet',
        ],
      },
      {
        id: 'physical-down',
        kind: 'choice',
        prompt:
          'Subinterfaces g0/0.10 and g0/0.20 are configured correctly, but both show down. What is the most likely fix?',
        choices: [
          'Delete and recreate the subinterfaces',
          'no shutdown on the physical interface g0/0',
          "Change the PCs' masks",
          'Add a second router',
        ],
      },
      {
        id: 'allowed-missing',
        kind: 'choice',
        prompt:
          "VLANs 10 and 20 can reach the router but VLAN 30 can't, and g0/0.30 looks right. What should you check on the switch?",
        choices: [
          'The hostname',
          'The console password',
          "The trunk's allowed VLAN list",
          'The MAC address table aging time',
        ],
      },
      {
        id: 'l3-switch',
        kind: 'choice',
        prompt: 'Which device can route between VLANs by itself, using SVIs?',
        choices: [
          'A hub',
          'A layer 2 switch',
          'A wireless access point',
          'A layer 3 (multilayer) switch',
        ],
      },
      {
        id: 'legacy-drawback',
        kind: 'choice',
        prompt: 'What is the main drawback of one physical router interface per VLAN?',
        choices: [
          "It doesn't work with 802.1Q",
          "It needs a router port and a cable for every VLAN, so it doesn't scale",
          'PCs need two default gateways',
          'It supports at most two VLANs',
        ],
      },
      {
        id: 'show-cmd',
        kind: 'choice',
        prompt:
          "Which router command quickly lists each interface's IP address and up/down status?",
        choices: [
          'show vlan brief',
          'show interfaces trunk',
          'show ip interface brief',
          'show mac address-table',
        ],
      },
      {
        id: 'connected-route',
        kind: 'choice',
        prompt:
          'After g0/0.10 and g0/0.20 have addresses and are up, how does the router know those two networks?',
        choices: [
          'They become connected routes automatically',
          'You must add a static route for each',
          "It learns them from the switch's MAC table",
          "It learns them from the PCs' gateways",
        ],
      },
      {
        id: 'subif-name',
        kind: 'input',
        prompt:
          'Name the subinterface for VLAN 30 on GigabitEthernet0/0, in short form like g0/0.10.',
        answerType: 'text',
        placeholder: 'g0/0.?',
      },
      {
        id: 'roas-ports',
        kind: 'input',
        prompt: 'How many physical router ports does router-on-a-stick need to route 5 VLANs?',
        answerType: 'number',
      },
      {
        id: 'legacy-ports',
        kind: 'input',
        prompt:
          'How many physical router ports does the one-port-per-VLAN design need to route 5 VLANs?',
        answerType: 'number',
      },
      {
        id: 'trunk-crossings',
        kind: 'input',
        prompt:
          'A packet from VLAN 10 to VLAN 20 goes through a router-on-a-stick. How many times does it cross the trunk?',
        answerType: 'number',
      },
      {
        id: 'gateway-ip',
        kind: 'input',
        prompt:
          'VLAN 20 uses 192.168.20.0/24 and its subinterface takes the first usable address. What gateway do VLAN 20 PCs use?',
        answerType: 'ip',
      },
      {
        id: 'first-usable-26',
        kind: 'input',
        prompt:
          'VLAN 30 uses 10.0.30.64/26, with the gateway on the first usable address. What is it?',
        answerType: 'ip',
      },
      {
        id: 'encap-vlan',
        kind: 'input',
        prompt:
          'PCs in VLAN 40 are routed by g0/0.40. What number goes in its encapsulation dot1Q command?',
        answerType: 'number',
      },
      {
        id: 'subnets-needed',
        kind: 'input',
        prompt:
          'VLANs 10, 20 and 30 are all routed by one router. How many IP subnets do you need?',
        answerType: 'number',
      },
      {
        id: 'broadcast-domains',
        kind: 'input',
        prompt: 'A router-on-a-stick routes VLANs 10 and 20. How many broadcast domains are there?',
        answerType: 'number',
      },
      {
        id: 'cmd-encap',
        kind: 'input',
        prompt: 'Complete the subinterface command for VLAN 10: encapsulation ____',
        answerType: 'text',
        placeholder: 'the rest of the command',
      },
    ],
  },
};
