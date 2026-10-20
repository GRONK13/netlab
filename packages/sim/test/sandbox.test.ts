import { describe, expect, it } from 'vitest';
import { LIMITS, Network } from '../src/index.ts';
import { fourPcs, run } from './helpers.ts';

const empty = () => new Network({ devices: [], links: [] });

describe('building a topology', () => {
  it('names devices like Packet Tracer', () => {
    const n = empty();
    expect(n.addDevice('switch', 50, 50).id).toBe('Switch0');
    expect(n.addDevice('switch', 60, 50).id).toBe('Switch1');
    expect(n.addDevice('router', 50, 10).id).toBe('Router0');
    expect(n.addDevice('pc', 10, 90).id).toBe('PC0');
    n.removeDevice('Switch0');
    expect(n.addDevice('switch', 0, 0).id).toBe('Switch0');
  });

  it('cables two devices and pings across them', () => {
    const n = empty();
    n.addDevice('switch', 50, 30);
    n.addDevice('pc', 20, 80);
    n.addDevice('pc', 80, 80);
    expect(n.connect({ device: 'Switch0', port: 'FastEthernet0/1' }, { device: 'PC0', port: 'FastEthernet0' })).toBeNull();
    expect(n.connect({ device: 'Switch0', port: 'FastEthernet0/2' }, { device: 'PC1', port: 'FastEthernet0' })).toBeNull();
    run(n, 'PC0', ['ipconfig 10.0.0.1 255.0.0.0']);
    run(n, 'PC1', ['ipconfig 10.0.0.2 255.0.0.0']);
    expect(n.ping('PC0', '10.0.0.2').success).toBe(true);
    n.disconnect('PC1', 'FastEthernet0');
    expect(n.ping('PC0', '10.0.0.2').success).toBe(false);
  });

  it('rejects bad cables', () => {
    const n = new Network(fourPcs);
    expect(n.connect({ device: 'SW1', port: 'FastEthernet0/1' }, { device: 'PC2', port: 'FastEthernet0' })).toContain(
      'already has a cable',
    );
    expect(n.connect({ device: 'SW1', port: 'FastEthernet0/9' }, { device: 'SW1', port: 'FastEthernet0/10' })).toContain(
      'two different devices',
    );
    expect(n.connect({ device: 'SW1', port: 'Serial0/0' }, { device: 'PC1', port: 'FastEthernet0' })).toContain('no port');
    expect(n.freePorts('PC1')).toEqual([]);
    expect(n.freePorts('SW1')).toHaveLength(22);
  });

  it('removes a device together with its cables', () => {
    const n = new Network(fourPcs);
    n.removeDevice('PC1');
    expect(n.peer('SW1', 'FastEthernet0/1')).toBeUndefined();
    expect(n.topology.links).toHaveLength(3);
  });

  it('enforces size limits', () => {
    const n = empty();
    for (let i = 0; i < LIMITS.devices; i++) n.addDevice('pc', 0, 0);
    expect(() => n.addDevice('pc', 0, 0)).toThrow('at most');
  });

  it('does not change the topology it was built from', () => {
    const n = new Network(fourPcs);
    n.removeDevice('PC1');
    expect(fourPcs.devices).toHaveLength(5);
  });
});

describe('snapshots', () => {
  it('round-trips layout, cables and configs', () => {
    const n = new Network(fourPcs);
    run(n, 'SW1', ['en', 'conf t', 'hostname CORE', 'vlan 10', 'name SALES', 'end', 'wr']);
    n.moveDevice('PC1', 12, 34);
    const copy = Network.fromSnapshot(JSON.parse(JSON.stringify(n.snapshot())));
    expect(copy.device('SW1').running.hostname).toBe('CORE');
    expect(copy.device('SW1').startup?.vlans['10']?.name).toBe('SALES');
    expect(copy.topology.devices.find((d) => d.id === 'PC1')).toMatchObject({ x: 12, y: 34 });
    expect(copy.ping('PC1', '192.168.1.12').success).toBe(true);
    expect(copy.prompt('SW1')).toBe('CORE>');
  });

  it('rejects malformed snapshots', () => {
    expect(() => Network.fromSnapshot({} as never)).toThrow();
    const bad = new Network(fourPcs).snapshot();
    bad.topology.links.push(bad.topology.links[0]!);
    expect(() => Network.fromSnapshot(bad)).toThrow('already has a cable');
    const weird = new Network(fourPcs).snapshot();
    weird.topology.devices[0]!.id = '<script>';
    expect(() => Network.fromSnapshot(weird)).toThrow('Bad device id');
  });
});

describe('terminal length', () => {
  it('sets the page size and 0 turns paging off', () => {
    const n = new Network(fourPcs);
    expect(n.pageLength('SW1')).toBe(24);
    run(n, 'SW1', ['en', 'terminal length 0']);
    expect(n.pageLength('SW1')).toBe(0);
    expect(n.pageLength('PC1')).toBe(0);
  });
});
