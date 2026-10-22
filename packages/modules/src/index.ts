import { deviceSecurity } from './content/device-security.ts';
import { interVlanRouting } from './content/inter-vlan-routing.ts';
import { ipAddressing } from './content/ip-addressing.ts';
import { switchingVlans } from './content/switching-vlans.ts';
import type { Module } from './types.ts';

/** Modules in the order students should take them. */
export const MODULES: Module[] = [ipAddressing, switchingVlans, interVlanRouting, deviceSecurity];

export function getModule(id: string): Module | undefined {
  return MODULES.find((m) => m.id === id);
}

export {
  TRAINERS,
  getTrainer,
  makeRound,
  solve,
  isCorrect,
  type TrainerSpec,
  type Problem,
  type ProblemKind,
} from './trainer.ts';
export { mulberry32, type Rng } from './random.ts';
export { dayNumber, fromDayNumber, weekStart } from './progress/days.ts';
export { streakOf, type Streak } from './progress/streak.ts';
export { GOAL_DEFAULT, GOAL_MAX, GOAL_MIN, weekOf, type Week } from './progress/week.ts';
export {
  WIDGETS,
  type WidgetName,
  type LessonSection,
  type Question,
  type Quiz,
  type Module,
} from './types.ts';
