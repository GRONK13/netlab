// The subnetting speed trainer: timed rounds of generated problems.
// A round is fully determined by its seed, so the server can re-grade it.

import { maskToPrefix, prefixForHosts, prefixToMask, subnetOf } from '@netlab/sim';
import { sameIp, sameNumber } from './normalize.ts';
import { mulberry32, pick, randInt, shuffle, type Rng } from './random.ts';

export interface TrainerSpec {
  kind: string;
  title: string;
  /** The module whose "trainer" step this completes. */
  moduleId: string;
  problems: number;
  /** Correct answers needed to earn the XP. */
  target: number;
  limitMs: number;
  xp: number;
}

export const TRAINERS: Record<string, TrainerSpec> = {
  subnetting: {
    kind: 'subnetting',
    title: 'Subnetting trainer',
    moduleId: 'ip-addressing',
    problems: 10,
    target: 8,
    limitMs: 5 * 60_000,
    xp: 50,
  },
};

export function getTrainer(kind: string): TrainerSpec | undefined {
  return Object.hasOwn(TRAINERS, kind) ? TRAINERS[kind] : undefined;
}

export type ProblemKind =
  'network' | 'broadcast' | 'first' | 'last' | 'hosts' | 'toMask' | 'toPrefix' | 'fitHosts';

export interface Problem {
  kind: ProblemKind;
  /** What the student is asked. */
  prompt: string;
  /** The expected answer's shape: drives the input hint and the checker. */
  answer: 'ip' | 'number';
  ip?: string;
  prefix?: number;
  mask?: string;
  hosts?: number;
}

const ADDRESS_KINDS = ['network', 'broadcast', 'first', 'last'] as const;
const ALL_KINDS: ProblemKind[] = [...ADDRESS_KINDS, 'hosts', 'toMask', 'toPrefix', 'fitHosts'];

/** A private address and a prefix that suits its range, weighted toward /24–/30 like the exam. */
function address(rng: Rng): { ip: string; prefix: number } {
  const o = () => randInt(rng, 0, 255);
  const [ip, lowest] = pick(rng, [
    () => [`10.${o()}.${o()}.${o()}`, 8] as const,
    () => [`172.${randInt(rng, 16, 31)}.${o()}.${o()}`, 16] as const,
    () => [`192.168.${o()}.${o()}`, 24] as const,
  ])();
  const prefix = rng() < 0.7 || lowest === 24 ? randInt(rng, 24, 30) : randInt(rng, lowest, 23);
  return { ip, prefix };
}

function problem(rng: Rng, kind: ProblemKind): Problem {
  switch (kind) {
    case 'network':
    case 'broadcast':
    case 'first':
    case 'last': {
      const { ip, prefix } = address(rng);
      const what = {
        network: 'Network address of',
        broadcast: 'Broadcast address of',
        first: 'First usable host in',
        last: 'Last usable host in',
      }[kind];
      return { kind, prompt: `${what} ${ip}/${prefix}?`, answer: 'ip', ip, prefix };
    }
    case 'hosts': {
      const prefix = randInt(rng, 16, 30);
      const prompt =
        rng() < 0.5
          ? `Usable hosts in a /${prefix}?`
          : `Usable hosts with mask ${prefixToMask(prefix)}?`;
      return { kind, prompt, answer: 'number', prefix };
    }
    case 'toMask': {
      const prefix = randInt(rng, 8, 30);
      return { kind, prompt: `/${prefix} as a subnet mask?`, answer: 'ip', prefix };
    }
    case 'toPrefix': {
      const mask = prefixToMask(randInt(rng, 8, 30));
      return { kind, prompt: `${mask} as a prefix length?`, answer: 'number', mask };
    }
    case 'fitHosts': {
      // Spread answers across sizes: pick a host-bit count, then a host count that needs it.
      const h = randInt(rng, 2, 11);
      const hosts = randInt(rng, Math.max(1, 2 ** (h - 1) - 1), 2 ** h - 2);
      return { kind, prompt: `Smallest prefix that fits ${hosts} hosts?`, answer: 'number', hosts };
    }
  }
}

/** The problems for a round. Every kind appears at least once when count ≥ 8. */
export function makeRound(seed: number, count: number): Problem[] {
  const rng = mulberry32(seed);
  const kinds = [...shuffle(rng, ALL_KINDS)];
  while (kinds.length < count) kinds.push(pick(rng, ADDRESS_KINDS));
  return kinds.slice(0, count).map((k) => problem(rng, k));
}

/** The canonical answer. */
export function solve(p: Problem): string {
  switch (p.kind) {
    case 'network':
      return subnetOf(p.ip!, p.prefix!).network;
    case 'broadcast':
      return subnetOf(p.ip!, p.prefix!).broadcast;
    case 'first':
      return subnetOf(p.ip!, p.prefix!).first;
    case 'last':
      return subnetOf(p.ip!, p.prefix!).last;
    case 'hosts':
      return String(subnetOf('0.0.0.0', p.prefix!).hosts);
    case 'toMask':
      return prefixToMask(p.prefix!);
    case 'toPrefix':
      return String(maskToPrefix(p.mask!));
    case 'fitHosts':
      return String(prefixForHosts(p.hosts!));
  }
}

/** Accepts "/26" or "26", spaces and thousands separators, and addresses with leading zeros. */
export function isCorrect(p: Problem, input: string): boolean {
  return p.answer === 'ip' ? sameIp(input, solve(p)) : sameNumber(input, solve(p));
}
