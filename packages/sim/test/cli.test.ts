import { describe, expect, it } from 'vitest';
import { Network } from '../src/index.ts';
import { fourPcs, roas, run } from './helpers.ts';

const net = () => new Network(fourPcs);

describe('modes and prompts', () => {
  it('moves through exec and config modes', () => {
    const n = net();
    expect(n.prompt('SW1')).toBe('Switch>');
    n.exec('SW1', 'enable');
    expect(n.prompt('SW1')).toBe('Switch#');
    expect(n.exec('SW1', 'configure terminal')).toContain('End with CNTL/Z.');
    expect(n.prompt('SW1')).toBe('Switch(config)#');
    n.exec('SW1', 'interface fa0/1');
    expect(n.prompt('SW1')).toBe('Switch(config-if)#');
    n.exec('SW1', 'exit');
    expect(n.prompt('SW1')).toBe('Switch(config)#');
    expect(n.exec('SW1', 'end')).toContain('%SYS-5-CONFIG_I');
    expect(n.prompt('SW1')).toBe('Switch#');
    n.exec('SW1', 'disable');
    expect(n.prompt('SW1')).toBe('Switch>');
  });

  it('accepts abbreviations and interface shorthand', () => {
    const n = net();
    run(n, 'SW1', ['en', 'conf t', 'hostn SW1', 'int f 0/2', 'desc Uplink to PC2']);
    expect(n.prompt('SW1')).toBe('SW1(config-if)#');
    expect(n.device('SW1').iface('FastEthernet0/2')!.description).toBe('Uplink to PC2');
  });

  it('falls back to global config commands from a sub-mode', () => {
    const n = net();
    run(n, 'SW1', ['en', 'conf t', 'int fa0/1', 'hostname CORE']);
    expect(n.prompt('SW1')).toBe('CORE(config-if)#');
    run(n, 'SW1', ['interface fa0/3']);
    expect(n.device('SW1').session.ifaces).toEqual(['FastEthernet0/3']);
  });

  it('runs exec commands with do', () => {
    const n = net();
    run(n, 'SW1', ['en', 'conf t']);
    expect(n.exec('SW1', 'do show vlan brief')).toContain('default');
    expect(n.prompt('SW1')).toBe('Switch(config)#');
  });
});

describe('errors', () => {
  it('points at the bad word with a caret', () => {
    const n = net();
    run(n, 'SW1', ['en', 'conf t']);
    const out = n.exec('SW1', 'hostnme SW1');
    const [caretLine, msg] = out.split('\n');
    expect(msg).toBe("% Invalid input detected at '^' marker.");
    expect(caretLine!.indexOf('^')).toBe('Switch(config)#'.length);
  });

  it('reports ambiguous and incomplete commands', () => {
    const n = net();
    n.exec('SW1', 'en');
    expect(n.exec('SW1', 'c')).toBe('% Ambiguous command:  "c"');
    expect(n.exec('SW1', 'show')).toBe('% Incomplete command.');
  });

  it('tries to resolve unknown single words as hostnames in exec mode', () => {
    expect(net().exec('SW1', 'hello')).toContain('Translating "hello"');
  });
});

describe('help and completion', () => {
  it('lists keywords for a partial word', () => {
    const n = net();
    n.exec('SW1', 'en');
    expect(n.help('SW1', 'co')).toContain('configure');
    expect(n.help('SW1', 'co')).toContain('copy');
  });

  it('lists next words with descriptions', () => {
    const n = net();
    n.exec('SW1', 'en');
    const out = n.help('SW1', 'show ');
    expect(out).toContain('running-config');
    expect(out).toContain('Current operating configuration');
  });

  it('completes a unique prefix with Tab', () => {
    const n = net();
    n.exec('SW1', 'en');
    expect(n.complete('SW1', 'conf')).toBe('configure ');
    expect(n.complete('SW1', 'show runn')).toBe('show running-config ');
    expect(n.complete('SW1', 'c')).toBeNull();
  });
});

describe('passwords and saving', () => {
  it('asks for the enable secret', () => {
    const n = net();
    run(n, 'SW1', ['en', 'conf t', 'enable secret class', 'end', 'disable', 'enable']);
    expect(n.prompt('SW1')).toBe('Password: ');
    expect(n.isSecretInput('SW1')).toBe(true);
    n.exec('SW1', 'wrong');
    expect(n.prompt('SW1')).toBe('Password: ');
    n.exec('SW1', 'class');
    expect(n.prompt('SW1')).toBe('Switch#');
  });

  it('shows the banner and asks for the console password after logout', () => {
    const n = net();
    run(n, 'SW1', [
      'en',
      'conf t',
      'banner motd #Authorized access only#',
      'line con 0',
      'password cisco',
      'login',
      'end',
    ]);
    expect(n.exec('SW1', 'exit')).toContain('Press RETURN to get started');
    const out = n.exec('SW1', '');
    expect(out).toContain('Authorized access only');
    expect(out).toContain('User Access Verification');
    expect(n.prompt('SW1')).toBe('Password: ');
    n.exec('SW1', 'cisco');
    expect(n.prompt('SW1')).toBe('Switch>');
  });

  it('encrypts passwords in the running config', () => {
    const n = net();
    run(n, 'SW1', ['en', 'conf t', 'line vty 0 4', 'password cisco', 'login', 'exit', 'service password-encryption', 'end']);
    const run1 = n.exec('SW1', 'show running-config');
    expect(run1).toContain('service password-encryption');
    expect(run1).toMatch(/line vty 0 4\n password 7 [0-9A-F]+\n login/);
    expect(run1).not.toContain('password cisco');
  });

  it('copies running-config to startup-config after confirmation', () => {
    const n = net();
    run(n, 'SW1', ['en', 'conf t', 'hostname SW1', 'end']);
    expect(n.exec('SW1', 'show startup-config')).toBe('startup-config is not present');
    n.exec('SW1', 'copy run start');
    expect(n.prompt('SW1')).toBe('Destination filename [startup-config]? ');
    expect(n.exec('SW1', '')).toContain('[OK]');
    expect(n.exec('SW1', 'show startup-config')).toContain('hostname SW1');
  });

  it('reload restores the startup config', () => {
    const n = net();
    run(n, 'SW1', ['en', 'conf t', 'hostname SAVED', 'end', 'wr', 'conf t', 'hostname UNSAVED', 'end', 'reload', '']);
    expect(n.device('SW1').running.hostname).toBe('SAVED');
  });
});

describe('VLANs and switchports', () => {
  it('creates VLANs and assigns access ports', () => {
    const n = net();
    run(n, 'SW1', [
      'en',
      'conf t',
      'vlan 10',
      'name SALES',
      'exit',
      'int range fa0/1 - 2',
      'switchport mode access',
      'switchport access vlan 10',
      'end',
    ]);
    const out = n.exec('SW1', 'show vlan brief');
    expect(out).toMatch(/10\s+SALES\s+active\s+Fa0\/1, Fa0\/2/);
    expect(out).toMatch(/1\s+default\s+active\s+Fa0\/3, Fa0\/4/);
  });

  it('creates a missing VLAN when a port is assigned to it', () => {
    const n = net();
    run(n, 'SW1', ['en', 'conf t', 'int fa0/1']);
    expect(n.exec('SW1', 'switchport access vlan 30')).toBe('% Access VLAN does not exist. Creating vlan 30');
    expect(n.device('SW1').running.vlans['30']!.name).toBe('VLAN0030');
  });

  it('edits the trunk allowed list', () => {
    const n = new Network(roas);
    run(n, 'SW1', ['en', 'conf t', 'int g0/1', 'switchport mode trunk', 'switchport trunk allowed vlan 10', 'switchport trunk allowed vlan add 20']);
    expect(n.device('SW1').iface('GigabitEthernet0/1')!.trunkAllowed).toEqual([10, 20]);
    run(n, 'R1', ['en', 'conf t', 'int g0/0', 'no shut']);
    const trunk = n.exec('SW1', 'do show interfaces trunk');
    expect(trunk).toContain('Gig0/1      on           802.1q         trunking      1');
    expect(trunk).toContain('10,20');
  });
});

describe('router interfaces', () => {
  it('starts shut down and reports the link coming up', () => {
    const n = new Network(roas);
    run(n, 'R1', ['en', 'conf t', 'int g0/0']);
    const out = n.exec('R1', 'no shutdown');
    expect(out).toContain('changed state to up');
    expect(n.ifaceUp('R1', 'GigabitEthernet0/0')).toBe(true);
  });

  it('requires dot1Q before an IP on a subinterface', () => {
    const n = new Network(roas);
    run(n, 'R1', ['en', 'conf t', 'int g0/0.10']);
    expect(n.prompt('R1')).toBe('Router(config-subif)#');
    expect(n.exec('R1', 'ip address 192.168.10.1 255.255.255.0')).toContain('only allowed if');
    n.exec('R1', 'encapsulation dot1Q 10');
    expect(n.exec('R1', 'ip address 192.168.10.1 255.255.255.0')).toBe('');
  });

  it('rejects network addresses and overlapping subnets', () => {
    const n = new Network(roas);
    run(n, 'R1', ['en', 'conf t', 'int g0/1']);
    expect(n.exec('R1', 'ip address 10.0.0.0 255.255.255.0')).toBe('Bad mask /24 for address 10.0.0.0');
    n.exec('R1', 'ip address 10.0.0.1 255.255.255.0');
    n.exec('R1', 'int g0/2');
    expect(n.exec('R1', 'ip address 10.0.0.2 255.255.255.0')).toBe('% 10.0.0.0 overlaps with GigabitEthernet0/1');
  });
});
