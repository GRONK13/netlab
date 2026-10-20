import { ipToInt, isIp, prefixToMask } from '@netlab/sim';
import { describe, expect, it } from 'vitest';
import { isCorrect, makeRound, mulberry32, solve, type Problem } from '../src/index.ts';

describe('seeded randomness', () => {
  it('repeats exactly for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(Array.from({ length: 5 }, mulberry32(43))).not.toEqual(seqA);
  });
});

describe('rounds', () => {
  it('rebuilds the same round from the same seed', () => {
    expect(makeRound(123456, 10)).toEqual(makeRound(123456, 10));
    expect(makeRound(123456, 10)).not.toEqual(makeRound(654321, 10));
  });

  it('covers every kind of problem in a round of 10', () => {
    for (let seed = 0; seed < 50; seed++) {
      const round = makeRound(seed, 10);
      expect(round).toHaveLength(10);
      expect(new Set(round.map((p) => p.kind)).size).toBe(8);
    }
  });

  it('only asks well-formed questions with sensible answers', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const p of makeRound(seed * 7919, 10)) {
        expect(p.prompt).not.toMatch(/undefined|NaN/);
        const answer = solve(p);
        if (p.answer === 'ip') expect(isIp(answer)).toBe(true);
        else expect(Number(answer)).toBeGreaterThan(0);
        if (p.ip !== undefined) {
          // The question's address always falls inside its own subnet.
          const net = ipToInt(solve({ ...p, kind: 'network' }));
          const bcast = ipToInt(solve({ ...p, kind: 'broadcast' }));
          expect(bcast - net + 1).toBe(2 ** (32 - p.prefix!));
          expect(ipToInt(p.ip)).toBeGreaterThanOrEqual(net);
          expect(ipToInt(p.ip)).toBeLessThanOrEqual(bcast);
        }
        expect(isCorrect(p, answer)).toBe(true);
      }
    }
  });
});

describe('answers', () => {
  const at = (kind: Problem['kind'], extra: Partial<Problem>): Problem => ({
    kind,
    prompt: '',
    answer:
      kind === 'network' ||
      kind === 'broadcast' ||
      kind === 'first' ||
      kind === 'last' ||
      kind === 'toMask'
        ? 'ip'
        : 'number',
    ...extra,
  });

  it('solves worked examples', () => {
    const p = { ip: '192.168.1.130', prefix: 26 };
    expect(solve(at('network', p))).toBe('192.168.1.128');
    expect(solve(at('broadcast', p))).toBe('192.168.1.191');
    expect(solve(at('first', p))).toBe('192.168.1.129');
    expect(solve(at('last', p))).toBe('192.168.1.190');
    expect(solve(at('hosts', { prefix: 27 }))).toBe('30');
    expect(solve(at('toMask', { prefix: 21 }))).toBe('255.255.248.0');
    expect(solve(at('toPrefix', { mask: prefixToMask(19) }))).toBe('19');
    expect(solve(at('fitHosts', { hosts: 50 }))).toBe('26');
  });

  it('accepts reasonable ways of writing an answer, and nothing else', () => {
    const net = at('network', { ip: '10.4.9.77', prefix: 27 });
    expect(isCorrect(net, '10.4.9.64')).toBe(true);
    expect(isCorrect(net, ' 010.004.009.064 ')).toBe(true);
    expect(isCorrect(net, '10.4.9.65')).toBe(false);
    expect(isCorrect(net, '10.4.9')).toBe(false);
    const fit = at('fitHosts', { hosts: 50 });
    expect(isCorrect(fit, '/26')).toBe(true);
    expect(isCorrect(fit, ' 26')).toBe(true);
    expect(isCorrect(fit, '255.255.255.192')).toBe(false);
    expect(isCorrect(at('hosts', { prefix: 20 }), '4,094')).toBe(true);
    expect(isCorrect(at('hosts', { prefix: 20 }), '')).toBe(false);
  });
});
