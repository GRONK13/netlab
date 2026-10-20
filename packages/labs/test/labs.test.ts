import { evaluateAll, Network } from '@netlab/sim';
import { describe, expect, it } from 'vitest';
import { getLab, LABS, levelFor, xpAward } from '../src/index.ts';
import { SOLUTIONS } from './solutions.ts';

describe.each(LABS.map((l) => [l.id, l] as const))('lab %s', (id, lab) => {
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
    for (const o of lab.objectives) {
      const c = o.check;
      if (c.type === 'ping') expect(ids.has(c.from)).toBe(true);
      else expect(ids.has(c.device)).toBe(true);
    }
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
