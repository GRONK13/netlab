import { routerOnAStick } from './labs/router-on-a-stick.ts';
import { switchBasics } from './labs/switch-basics.ts';
import { vlans } from './labs/vlans.ts';
import type { Lab } from './types.ts';

/** Labs in the order students should do them. */
export const LABS: Lab[] = [switchBasics, vlans, routerOnAStick];

export function getLab(id: string): Lab | undefined {
  return LABS.find((l) => l.id === id);
}

export { levelFor, xpAward, LEVELS, MAX_HINTS, HINT_PENALTY, type LevelInfo } from './progression.ts';
export type { Lab, Objective, CcnaDomain } from './types.ts';
