import { describe, expect, it } from 'vitest';
import { browse, MODELS, Network } from '../src/index.ts';
import { roas, run } from './helpers.ts';

const empty = () => new Network({ devices: [], links: [] });
const cable = (n: Network, a: string, ap: string, b: string, bp = 'FastEthernet0') =>
  expect(n.connect({ device: a, port: ap }, { device: b, port: bp })).toBeNull();

describe('device catalog', () => {
  it('gives each model its own ports', () => {
    const n = empty();
    expect(n.addDevice('router', 0, 0, '1941').ports).toEqual(['GigabitEthernet0/0', 'GigabitEthernet0/1']);
    expect(n.addDevice('router', 0, 0, 'ISR4321').ports[0]).toBe('GigabitEthernet0/0/0');
    expect(n.addDevice('switch', 0, 0, '2960-48TT').ports).toHaveLength(50);
    expect(n.addDevice('hub', 0, 0).ports).toHaveLength(6);
    expect(n.addDevice('laptop', 0, 0).id).toBe('Laptop0');
    expect(n.addDevice('router', 0, 0, 'nonsense').model).toBe('2911');
  });

  it('lists every kind with at least one model', () => {
    const kinds = new Set(MODELS.map((m) => m.kind));
    expect([...kinds].sort()).toEqual(['hub', 'laptop', 'pc', 'printer', 'router', 'server', 'switch']);
  });

  it('rejects a snapshot with a model that does not match its kind', () => {
    const n = empty();
    n.addDevice('router', 0, 0);
    const s = n.snapshot();
    s.topology.devices[0]!.model = '2960-24TT';
    expect(() => Network.fromSnapshot(s)).toThrow('Bad device model');
  });
});

describe('hub', () => {
  it('repeats frames between every port', () => {
    const n = empty();
    n.addDevice('hub', 50, 20);
    n.addDevice('pc', 20, 80);
    n.addDevice('laptop', 50, 80);
    n.addDevice('printer', 80, 80);
    cable(n, 'Hub0', 'Port0', 'PC0');
    cable(n, 'Hub0', 'Port1', 'Laptop0');
    cable(n, 'Hub0', 'Port2', 'Printer0');
    run(n, 'PC0', ['ipconfig 10.1.1.1 255.255.255.0']);
    run(n, 'Laptop0', ['ipconfig 10.1.1.2 255.255.255.0']);
    run(n, 'Printer0', ['ipconfig 10.1.1.3 255.255.255.0']);
    expect(n.ping('PC0', '10.1.1.2').success).toBe(true);
    expect(n.ping('Laptop0', '10.1.1.3').success).toBe(true);
    expect(n.exec('Hub0', 'show run')).toBe('');
  });
});

describe('ISR4321 three-part interface names', () => {
  it('configures and routes on Gi0/0/0', () => {
    const n = empty();
    n.addDevice('router', 50, 10, 'ISR4321');
    n.addDevice('pc', 20, 80);
    n.addDevice('pc', 80, 80);
    cable(n, 'Router0', 'GigabitEthernet0/0/0', 'PC0');
    cable(n, 'Router0', 'GigabitEthernet0/0/1', 'PC1');
    run(n, 'Router0', [
      'en',
      'conf t',
      'int g0/0/0',
      'ip add 10.0.1.1 255.255.255.0',
      'no shut',
      'int g0/0/1',
      'ip add 10.0.2.1 255.255.255.0',
      'no shut',
    ]);
    run(n, 'PC0', ['ipconfig 10.0.1.10 255.255.255.0 10.0.1.1']);
    run(n, 'PC1', ['ipconfig 10.0.2.10 255.255.255.0 10.0.2.1']);
    expect(n.ping('PC0', '10.0.2.10').success).toBe(true);
  });
});

describe('PC command prompt', () => {
  const routed = () => {
    const n = new Network(roas);
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
    return n;
  };

  it('traces the route through the router', () => {
    const out = routed().exec('PC1', 'tracert 192.168.20.10');
    expect(out).toMatch(/1 {3}0 ms.*192\.168\.10\.1/);
    expect(out).toMatch(/2 {3}0 ms.*192\.168\.20\.10/);
    expect(out).toContain('Trace complete.');
  });

  it('shows timeouts after the path breaks', () => {
    const out = new Network(roas).exec('PC1', 'tracert 192.168.20.10');
    expect(out).toContain('1   *         *         *         Request timed out.');
    expect(out.split('\n').filter((l) => l.includes('timed out'))).toHaveLength(30);
  });

  it('learns the gateway in the ARP cache', () => {
    const n = routed();
    expect(n.exec('PC1', 'arp -a')).toBe('No ARP Entries Found');
    n.exec('PC1', 'ping 192.168.20.10');
    expect(n.exec('PC1', 'arp -a')).toMatch(/192\.168\.10\.1\s+0060\.\w{4}\.\w{4}\s+dynamic/);
    n.exec('PC1', 'arp -d');
    expect(n.exec('PC1', 'arp -a')).toBe('No ARP Entries Found');
  });

  it('supports ping -n, ipconfig /all and hostname', () => {
    const n = routed();
    expect(n.exec('PC1', 'ping -n 2 192.168.20.10')).toContain('Sent = 2, Received = 2');
    expect(n.exec('PC1', 'ipconfig /all')).toContain('Physical Address');
    expect(n.exec('PC1', 'ipconfig /all')).toContain('Media State.....................: Connected');
    expect(n.exec('PC1', 'hostname')).toBe('PC1');
    expect(n.exec('PC1', 'nonsense')).toBe('Invalid Command.');
  });
});

describe('web browser', () => {
  const lan = () => {
    const n = empty();
    n.addDevice('switch', 50, 20);
    n.addDevice('pc', 20, 80);
    n.addDevice('server', 80, 80);
    cable(n, 'Switch0', 'FastEthernet0/1', 'PC0');
    cable(n, 'Switch0', 'FastEthernet0/2', 'Server0');
    run(n, 'PC0', ['ipconfig 192.168.0.10 255.255.255.0']);
    run(n, 'Server0', ['ipconfig 192.168.0.100 255.255.255.0']);
    return n;
  };

  it('loads the server page', () => {
    const r = browse(lan(), 'PC0', 'http://192.168.0.100/');
    expect(r.ok && r.page.title).toBe('Welcome to Server0');
  });

  it('explains why a page fails', () => {
    const n = lan();
    expect(browse(n, 'Server0', 'http://192.168.0.10')).toMatchObject({ ok: false, error: 'Connection refused' });
    expect(browse(n, 'PC0', 'http://192.168.0.99')).toMatchObject({ ok: false, error: 'Request Timeout' });
    expect(browse(n, 'PC0', 'www.netlab.local')).toMatchObject({ ok: false, error: "This site can't be reached" });
  });

  it('serves a custom page', () => {
    const n = lan();
    n.device('Server0').running.http = { title: 'Intranet', body: 'Hello' };
    const r = browse(n, 'PC0', '192.168.0.100');
    expect(r.ok && r.page.title).toBe('Intranet');
  });
});
