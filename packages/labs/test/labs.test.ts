import { evaluateAll, Network, type Check } from '@netlab/sim';
import { describe, expect, it } from 'vitest';
import { getLab, LABS, levelFor, PRACTICES, xpAward } from '../src/index.ts';
import { SOLUTIONS } from './solutions.ts';

/** Every device a check refers to, including inside `all` and PC ping targets. */
function devicesIn(c: Check): string[] {
  if (c.type === 'all') return c.checks.flatMap(devicesIn);
  if (c.type === 'ping') return /^\d/.test(c.to) ? [c.from] : [c.from, c.to];
  return [c.device];
}

describe.each([...LABS, ...PRACTICES].map((l) => [l.id, l] as const))('lab %s', (id, lab) => {
  it('has a reference solution that passes every objective', () => {
    const net = Network.replay(lab.topology, SOLUTIONS[id]!);
    const results = evaluateAll(net, lab.objectives.map((o) => o.check));
    const failed = lab.objectives.filter((_, i) => !results[i]).map((o) => o.label);
    expect(failed).toEqual([]);
  });

  it('is not already solved at the start', () => {
    const net = new Network(lab.topology);
    const results = evaluateAll(net, lab.objectives.map((o) => o.check));
    expect(results.every(Boolean)).toBe(false);
  });

  it('only references devices that exist', () => {
    const ids = new Set(lab.topology.devices.map((d) => d.id));
    for (const o of lab.objectives) for (const d of devicesIn(o.check)) expect(ids.has(d)).toBe(true);
    expect(lab.hints).toHaveLength(3);
  });
});

describe('common mistakes', () => {
  it('switch basics: changing anything after saving leaves the config unsaved', () => {
    const lab = getLab('switch-basics')!;
    const late = [
      ...SOLUTIONS['switch-basics']!,
      { device: 'SW1', line: 'conf t' },
      { device: 'SW1', line: 'hostname SW1-NEW' },
    ];
    const net = Network.replay(lab.topology, late);
    const saved = lab.objectives.findIndex((o) => o.check.type === 'configSaved');
    expect(evaluateAll(net, lab.objectives.map((o) => o.check))[saved]).toBe(false);
  });

  it('router on a stick: forgetting no shutdown fails the pings', () => {
    const lab = getLab('router-on-a-stick')!;
    const log = SOLUTIONS['router-on-a-stick']!.filter((e) => e.line !== 'no shutdown');
    const net = Network.replay(lab.topology, log);
    expect(net.ping('PC1', '192.168.20.10').success).toBe(false);
  });
});

describe('guided practice', () => {
  it('explains every step', () => {
    for (const lab of PRACTICES) {
      expect(lab.guided).toBe(true);
      for (const o of lab.objectives) expect(o.why?.length).toBeGreaterThan(20);
    }
  });

  it('same subnet or not: a mismatched mask breaks the reply path', () => {
    const lab = getLab('ip-practice')!;
    const net = Network.replay(lab.topology, SOLUTIONS['ip-practice']!);
    expect(net.ping('PC1', '192.168.1.20').success).toBe(true);
    expect(net.ping('PC1', '192.168.1.200').success).toBe(false);
    // Give PC4 the matching /24 and it answers.
    net.exec('PC4', 'ipconfig 192.168.1.200 255.255.255.0');
    expect(net.ping('PC1', '192.168.1.200').success).toBe(true);
  });

  it('one switch, two networks: moving one port cuts it off, moving its neighbour reconnects them', () => {
    const lab = getLab('vlan-practice')!;
    const log = SOLUTIONS['vlan-practice']!;
    const firstPort = Network.replay(lab.topology, log.slice(0, log.findIndex((e) => e.line === 'interface fa0/2')));
    expect(firstPort.ping('PC1', '192.168.1.12').success).toBe(false);
    expect(firstPort.ping('PC1', '192.168.1.13').success).toBe(false);
    expect(firstPort.ping('PC2', '192.168.1.13').success).toBe(true);
    const done = Network.replay(lab.topology, log);
    expect(done.ping('PC1', '192.168.1.12').success).toBe(true);
    expect(done.ping('PC3', '192.168.1.11').success).toBe(false);
  });
});

describe('address the branch office', () => {
  const lab = getLab('address-the-office')!;
  const results = (log: { device: string; line: string }[]) =>
    evaluateAll(Network.replay(lab.topology, log), lab.objectives.map((o) => o.check));

  it('accepts any usable PC address in the right subnet', () => {
    const log = SOLUTIONS['address-the-office']!.map((e) =>
      e.device === 'PC2' ? { ...e, line: 'ipconfig 192.168.50.126 255.255.255.128 192.168.50.1' } : e,
    );
    expect(results(log).every(Boolean)).toBe(true);
  });

  it('rejects a /24 mask, the subnet broadcast address and a missing gateway', () => {
    const swap = (pc: string, line: string) =>
      results(SOLUTIONS['address-the-office']!.map((e) => (e.device === pc ? { ...e, line } : e)));
    expect(swap('PC1', 'ipconfig 192.168.50.10 255.255.255.0 192.168.50.1').every(Boolean)).toBe(false);
    expect(swap('PC2', 'ipconfig 192.168.50.127 255.255.255.128 192.168.50.1').every(Boolean)).toBe(false);
    expect(swap('PC3', 'ipconfig 192.168.50.140 255.255.255.128').every(Boolean)).toBe(false);
  });
});

describe('progression', () => {
  it('maps XP to levels', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, rank: 'Cable Runner', next: 100, progress: 0 });
    expect(levelFor(175)).toMatchObject({ level: 2, floor: 100, next: 250, progress: 0.5 });
    expect(levelFor(450).rank).toBe('VLAN Wrangler');
    expect(levelFor(99999)).toMatchObject({ level: 9, next: null, progress: 1 });
  });

  it('takes 10% per hint, at most 3 hints', () => {
    expect(xpAward(200, 0)).toBe(200);
    expect(xpAward(200, 1)).toBe(180);
    expect(xpAward(150, 3)).toBe(105);
    expect(xpAward(150, 9)).toBe(105);
  });
});
