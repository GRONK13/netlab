import { getLab } from '@netlab/labs';
import { getTrainer } from '../trainer.ts';
import type { Module } from '../types.ts';

export type StepKey = 'lesson' | 'practice' | 'trainer' | 'quiz' | 'challenge';

/** What a student has finished: labs (graded or practice) and module steps. */
export interface Done {
  labs: ReadonlySet<string>;
  /** `moduleId:step` for lessons, trainers and quizzes. */
  steps: ReadonlySet<string>;
}

export function doneFrom(
  labIds: Iterable<string>,
  steps: Iterable<{ moduleId: string; step: string }>,
): Done {
  return {
    labs: new Set(labIds),
    steps: new Set(Array.from(steps, (s) => `${s.moduleId}:${s.step}`)),
  };
}

export interface ModuleStep {
  key: StepKey;
  /** The lab id for practice and challenge, the trainer kind for a trainer, else the module id. */
  ref: string;
  done: boolean;
}

/**
 * A module's steps in order, and whether each is done. Steps a module doesn't have are
 * left out. The module page, mastery and badges all count from this.
 */
export function moduleSteps(mod: Module, done: Done): ModuleStep[] {
  const step = (s: string) => done.steps.has(`${mod.id}:${s}`);
  const steps: ModuleStep[] = [{ key: 'lesson', ref: mod.id, done: step('lesson') }];
  if (mod.practice && getLab(mod.practice)) {
    steps.push({ key: 'practice', ref: mod.practice, done: done.labs.has(mod.practice) });
  }
  if (mod.trainer && getTrainer(mod.trainer)) {
    steps.push({ key: 'trainer', ref: mod.trainer, done: step('trainer') });
  }
  steps.push({ key: 'quiz', ref: mod.id, done: step('quiz') });
  if (mod.challenge && getLab(mod.challenge)) {
    steps.push({ key: 'challenge', ref: mod.challenge, done: done.labs.has(mod.challenge) });
  }
  return steps;
}
