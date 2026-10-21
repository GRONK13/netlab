import { addressTheOffice } from './labs/address-the-office.ts';
import { ipPractice } from './labs/ip-practice.ts';
import { routerOnAStick } from './labs/router-on-a-stick.ts';
import { routingPractice } from './labs/routing-practice.ts';
import { securityPractice } from './labs/security-practice.ts';
import { switchBasics } from './labs/switch-basics.ts';
import { vlanPractice } from './labs/vlan-practice.ts';
import { vlans } from './labs/vlans.ts';
import type { Lab } from './types.ts';

/** Graded labs in the order students should do them. */
export const LABS: Lab[] = [switchBasics, addressTheOffice, vlans, routerOnAStick];

/** Guided practice labs. Reached from their modules; not listed with the graded labs. */
export const PRACTICES: Lab[] = [ipPractice, vlanPractice, routingPractice, securityPractice];

export function getLab(id: string): Lab | undefined {
  return LABS.find((l) => l.id === id) ?? PRACTICES.find((l) => l.id === id);
}

export { levelFor, xpAward, LEVELS, MAX_HINTS, HINT_PENALTY, type LevelInfo } from './progression.ts';
export type { Lab, Objective, CcnaDomain } from './types.ts';
