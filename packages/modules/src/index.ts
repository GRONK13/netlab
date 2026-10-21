import { ipAddressing } from './content/ip-addressing.ts';
import { switchingVlans } from './content/switching-vlans.ts';
import type { Module } from './types.ts';

/** Modules in the order students should take them. */
export const MODULES: Module[] = [ipAddressing, switchingVlans];

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
export {
  WIDGETS,
  type WidgetName,
  type LessonSection,
  type Question,
  type Quiz,
  type Module,
} from './types.ts';
