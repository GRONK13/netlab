import type { Module } from '../types.ts';

export const deviceSecurity: Module = {
  id: 'device-security',
  number: 4,
  title: 'Device Security',
  summary:
    'Lock down a switch or router: privileged EXEC and line passwords, encryption, SSH, banners, unused ports, and saving your work.',
  ccnaDomain: 'Security Fundamentals',
  practice: 'security-practice',
  challenge: 'switch-basics',
  lesson: [
    {
      id: 'why',
      title: 'Why lock down a device',
      body: `Out of the box, a Cisco switch has **no passwords at all**. Anyone with a console cable, or network access to a remote session, can reach privileged EXEC mode (the \`#\` prompt) and change, erase or copy the whole configuration.

There are three ways in, and each needs protecting:

| Access | How | Configured under |
|---|---|---|
| Console | A cable plugged into the console port | \`line console 0\` |
| Remote (VTY) | Telnet or SSH over the network | \`line vty 0 15\` (or \`0 4\`) |
| AUX | An old modem port on some routers | \`line aux 0\` |

Getting into the device is only the first door. The second is \`enable\`, which takes you from user EXEC (\`>\`) to privileged EXEC (\`#\`).`,
    },
    {
      id: 'enable',
      title: 'enable secret, not enable password',
      body: `Two commands protect privileged EXEC, and only one of them is a good idea:

| Command | Stored in the config as | Use it? |
|---|---|---|
| \`enable password\` | Plain text (or weak type 7) | No |
| \`enable secret\` | A one-way hash: type 5 (MD5), or 8/9 on newer IOS | Yes |

\`\`\`
SW1(config)# enable secret Class1
SW1(config)# do show running-config
...
enable secret 5 $1$mERr$mwcrp6BDyEsnt2ZveYsDB.
...
\`\`\`

> If both are set, IOS ignores \`enable password\` and uses \`enable secret\`.`,
    },
    {
      id: 'lines',
      title: 'Console and VTY passwords',
      body: `Each line needs two commands: \`password\` sets the password, and \`login\` tells the line to ask for it. Forget \`login\` and the password is never checked.

\`\`\`
SW1(config)# line console 0
SW1(config-line)# password Cisco1
SW1(config-line)# login
SW1(config-line)# line vty 0 15
SW1(config-line)# password Cisco1
SW1(config-line)# login
\`\`\`

\`line vty 0 4\` covers the first 5 remote sessions; most switches have 16 (0 to 15), and any you leave unprotected are a way in.

> In NetLab you can test the console password yourself: \`end\`, then \`logout\`, then press Enter. You'll see the banner and a password prompt, just like a real console.`,
    },
    {
      id: 'encryption',
      title: 'Encrypting the rest',
      body: `\`enable secret\` is hashed, but line passwords sit in the configuration in plain text, readable by anyone who sees \`show running-config\` or a saved copy. One global command fixes that:

\`\`\`
SW1(config)# service password-encryption
\`\`\`

Afterwards the console password \`Cisco1\` shows as \`password 7 0802455D0A1654\`. **Type 7** is a simple reversible scramble: it stops someone glancing at your screen, not an attacker with the config file. That's why the enable password should always be a \`secret\`.`,
    },
    {
      id: 'ssh',
      title: 'SSH instead of Telnet',
      body: `Telnet sends everything, passwords included, as plain text that anyone capturing traffic can read. **SSH** encrypts the whole session, so it's the only remote access you should allow. A typical CCNA setup:

\`\`\`
R1(config)# hostname R1
R1(config)# ip domain-name netlab.local
R1(config)# crypto key generate rsa modulus 2048
R1(config)# ip ssh version 2
R1(config)# username admin secret Admin123
R1(config)# line vty 0 15
R1(config-line)# login local
R1(config-line)# transport input ssh
\`\`\`

- The **hostname** and **domain name** name the RSA key pair, so both must be set first.
- \`login local\` checks the **local username** database instead of a single line password.
- \`transport input ssh\` refuses Telnet on those lines.

> NetLab doesn't simulate SSH yet. It arrives with the security track, so learn the commands here and the quiz will check them.`,
    },
    {
      id: 'hardening',
      title: 'Banners and unused ports',
      body: `A **message-of-the-day banner** appears before login. Use it for a legal warning, never a welcome: "Welcome" has been argued in court as an invitation.

\`\`\`
SW1(config)# banner motd #Authorized access only. Activity is monitored.#
\`\`\`

The \`#\` characters mark where the text starts and ends; any character that isn't in the message works.

**Unused switch ports** are an open door: anyone can walk up and plug in. Shut them down, several at once with a range:

\`\`\`
SW1(config)# interface range fa0/20 - 24
SW1(config-if-range)# shutdown
\`\`\`

Real networks also move unused ports to an unused VLAN, and use **port security** to limit which devices may connect.`,
    },
    {
      id: 'save',
      title: 'Save it, or lose it',
      body: `Everything you type changes the **running configuration**, which lives in RAM. The **startup configuration** in NVRAM is what the device loads when it boots. Until you save, a reload or power cut throws your work away.

| Command | What it does |
|---|---|
| \`copy running-config startup-config\` | Saves the running config as the startup config |
| \`write memory\` (or \`write\`) | Older shortcut for the same thing |
| \`show startup-config\` | Shows what the device will boot with |
| \`reload\` | Restarts, loading the startup config |

Next: the **guided practice** locks down a switch step by step. Then the checkpoint quiz, and the **Switch Basics** challenge, where you do it all without help.`,
    },
  ],
  quiz: {
    draw: 10,
    pass: 8,
    xp: 75,
    questions: [
      {
        id: 'secret-vs-password',
        kind: 'choice',
        prompt: 'If both enable secret and enable password are set, which one does IOS use?',
        choices: [
          'enable password',
          'Whichever was set last',
          'enable secret',
          'Both, one after the other',
        ],
      },
      {
        id: 'secret-storage',
        kind: 'choice',
        prompt: 'How does enable secret store the password in the configuration?',
        choices: [
          'As a one-way hash (type 5 or newer)',
          'In plain text',
          'Type 7 reversible encryption',
          "It isn't stored",
        ],
      },
      {
        id: 'type7',
        kind: 'choice',
        prompt: 'What does service password-encryption do to line passwords?',
        choices: [
          'Hashes them with MD5',
          'Scrambles them as type 7, which is easy to reverse',
          'Deletes them from the running config',
          'Moves them to the startup config',
        ],
      },
      {
        id: 'login-missing',
        kind: 'choice',
        prompt:
          'You set password Cisco1 on line console 0 but forget the login command. What happens?',
        choices: [
          'The console asks for the password',
          'The console is locked completely',
          'Only the VTY lines ask for it',
          'The console never asks for a password',
        ],
      },
      {
        id: 'vty-purpose',
        kind: 'choice',
        prompt: 'What are VTY lines used for?',
        choices: [
          'Remote access with Telnet or SSH',
          'The physical console port',
          'Modems on the AUX port',
          'Forwarding frames between switch ports',
        ],
      },
      {
        id: 'telnet-risk',
        kind: 'choice',
        prompt: 'Why is SSH preferred over Telnet?',
        choices: [
          'SSH is faster',
          'Telnet sends everything, passwords included, in plain text',
          'Telnet only works on routers',
          'SSH needs no configuration',
        ],
      },
      {
        id: 'ssh-needs',
        kind: 'choice',
        prompt: 'Which of these is NOT needed to set up SSH on a Cisco device?',
        choices: ['A hostname', 'An IP domain name', 'RSA keys', 'A message-of-the-day banner'],
      },
      {
        id: 'banner-wording',
        kind: 'choice',
        prompt: 'What should a login banner say?',
        choices: [
          'Welcome to the network!',
          "The device's model and IOS version",
          'That access is for authorized users only',
          'A hint for the enable password',
        ],
      },
      {
        id: 'unused-ports',
        kind: 'choice',
        prompt: 'What is good practice for unused switch ports?',
        choices: [
          'Leave them up in VLAN 1',
          'Shut them down',
          'Make them trunks',
          'Give them IP addresses',
        ],
      },
      {
        id: 'reload-unsaved',
        kind: 'choice',
        prompt:
          'You configure a switch for an hour, and it reloads before you save. Which configuration does it come back with?',
        choices: [
          'The startup configuration',
          'The running configuration',
          'Always a blank configuration',
          'Only the banner you set',
        ],
      },
      {
        id: 'save-cmd',
        kind: 'choice',
        prompt: 'Which command saves your configuration so it survives a reload?',
        choices: [
          'show running-config',
          'reload',
          'copy running-config startup-config',
          'service password-encryption',
        ],
      },
      {
        id: 'transport',
        kind: 'choice',
        prompt: 'Which line command allows only SSH, and not Telnet, on the VTY lines?',
        choices: ['login local', 'password ssh', 'crypto key generate rsa', 'transport input ssh'],
      },
      {
        id: 'vty-default',
        kind: 'input',
        prompt: 'How many VTY lines does line vty 0 4 configure?',
        answerType: 'number',
      },
      {
        id: 'vty-all',
        kind: 'input',
        prompt: 'Most Cisco switches have VTY lines 0 to 15. How many lines is that?',
        answerType: 'number',
      },
      {
        id: 'type-secret',
        kind: 'input',
        prompt: 'In "enable secret 5 $1$mERr$...", which type number marks the MD5 hash?',
        answerType: 'number',
      },
      {
        id: 'type-seven',
        kind: 'input',
        prompt: 'Which password type number does service password-encryption produce?',
        answerType: 'number',
      },
      {
        id: 'ssh-port',
        kind: 'input',
        prompt: 'Which TCP port does SSH use?',
        answerType: 'number',
      },
      {
        id: 'telnet-port',
        kind: 'input',
        prompt: 'Which TCP port does Telnet use?',
        answerType: 'number',
      },
      {
        id: 'cmd-console',
        kind: 'input',
        prompt: 'Complete the command that enters console line configuration: line ____',
        answerType: 'text',
        placeholder: 'the rest of the command',
      },
      {
        id: 'cmd-save-short',
        kind: 'input',
        prompt: 'Complete the older shortcut that saves the configuration: write ____',
        answerType: 'text',
        placeholder: 'the rest of the command',
      },
      {
        id: 'cmd-encrypt',
        kind: 'input',
        prompt: 'Complete the global command that encrypts plain-text passwords: service ____',
        answerType: 'text',
        placeholder: 'the rest of the command',
      },
      {
        id: 'cmd-secret',
        kind: 'input',
        prompt:
          'Fill in the missing word so the privileged EXEC password is stored as a hash: enable ____ Class1',
        answerType: 'text',
        placeholder: 'one word',
      },
    ],
  },
};
