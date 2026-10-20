import { describe, expect, it } from 'vitest';
import { Network } from '../src/index.ts';
import { fourPcs, roas, run } from './helpers.ts';

describe('switching', () => {
  it('pings within the default VLAN', () => {
    const n = new Network(fourPcs);
    expect(n.ping('PC1', '192.168.1.13').success).toBe(true);
    expect(n.exec('PC1', 'ping 192.168.1.13')).toContain('Received = 4');
  });

  it('separates VLANs', () => {
    const n = new Network(fourPcs);
    run(n, 'SW1', ['en', 'conf t', 'int range fa0/1 - 2', 'sw acc vl 10', 'int range fa0/3 - 4', 'sw acc vl 20']);
    expect(n.ping('PC1', '192.168.1.12').success).toBe(true);
    expect(n.ping('PC3', '192.168.1.14').success).toBe(true);
    const cross = n.ping('PC1', '192.168.1.13');
    expect(cross.success).toBe(false);
    expect(cross.reason).toContain('check VLANs');
  });

  it('fails through a shut down port', () => {
    const n = new Network(fourPcs);
    run(n, 'SW1', ['en', 'conf t', 'int fa0/2', 'shutdown']);
    expect(n.ping('PC1', '192.168.1.12').success).toBe(false);
  });

  it('drops traffic for a deleted VLAN', () => {
    const n = new Network(fourPcs);
    run(n, 'SW1', ['en', 'conf t', 'int range fa0/1 - 2', 'sw acc vl 10', 'exit', 'no vlan 10']);
    expect(n.ping('PC1', '192.168.1.12').success).toBe(false);
  });
});

describe('router on a stick', () => {
  const configure = (n: Network) => {
    run(n, 'SW1', ['en', 'conf t', 'int g0/1', 'switchport mode trunk', 'end']);
    run(n, 'R1', [
      'en',
      'conf t',
      'int g0/0',
      'no shut',
      'int g0/0.10',
      'encapsulation dot1Q 10',
      'ip add 192.168.10.1 255.255.255.0',
      'int g0/0.20',
      'encapsulation dot1Q 20',
      'ip add 192.168.20.1 255.255.255.0',
      'end',
    ]);
  };

  it('routes between VLANs', () => {
    const n = new Network(roas);
    expect(n.ping('PC1', '192.168.20.10').success).toBe(false);
    configure(n);
    const r = n.ping('PC1', '192.168.20.10');
    expect(r).toEqual({ success: true, path: ['PC1', 'R1', 'PC2'] });
    expect(n.exec('R1', 'ping 192.168.10.10')).toContain('!!!!!');
  });

  it('needs the trunk', () => {
    const n = new Network(roas);
    configure(n);
    run(n, 'SW1', ['en', 'conf t', 'int g0/1', 'switchport mode access']);
    expect(n.ping('PC1', '192.168.20.10').reason).toContain('default gateway 192.168.10.1');
  });

  it('needs the VLAN allowed on the trunk', () => {
    const n = new Network(roas);
    configure(n);
    run(n, 'SW1', ['en', 'conf t', 'int g0/1', 'switchport trunk allowed vlan 10']);
    expect(n.ping('PC1', '192.168.10.1').success).toBe(true);
    expect(n.ping('PC1', '192.168.20.10').success).toBe(false);
  });

  it('needs the reply path (destination gateway)', () => {
    const n = new Network(roas);
    configure(n);
    run(n, 'PC2', ['ipconfig 192.168.20.10 255.255.255.0']);
    const r = n.ping('PC1', '192.168.20.10');
    expect(r.success).toBe(false);
    expect(r.reason).toContain("Reply couldn't get back");
  });
});

describe('determinism', () => {
  it('replays to identical state', () => {
    const log = [
      { device: 'SW1', line: 'en' },
      { device: 'SW1', line: 'conf t' },
      { device: 'SW1', line: 'enable secret class' },
      { device: 'SW1', line: 'service password-encryption' },
      { device: 'SW1', line: 'line con 0' },
      { device: 'SW1', line: 'password cisco' },
      { device: 'SW1', line: 'do show run' },
    ];
    const a = Network.replay(fourPcs, log);
    const b = Network.replay(fourPcs, log);
    expect(a.exec('SW1', 'do show run')).toBe(b.exec('SW1', 'do show run'));
  });
});
