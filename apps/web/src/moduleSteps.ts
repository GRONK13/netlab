import { getLab } from '@netlab/labs';
import { doneFrom, getTrainer, moduleSteps, type Module, type StepKey } from '@netlab/modules';
import type { Me } from './api.ts';

export interface Step {
  key: StepKey;
  title: string;
  description: string;
  xp: number;
  done: boolean;
  href: string;
}

/** What this student has finished, for the shared progress functions. */
export const doneFor = (me: Me) => doneFrom(me.completions.map((c) => c.labId), me.moduleSteps);

/** A module's steps in order, with this student's progress. Steps a module doesn't have are left out. */
export function stepsFor(mod: Module, me: Me): Step[] {
  return moduleSteps(mod, doneFor(me)).map(({ key, ref, done }): Step => {
    switch (key) {
      case 'lesson':
        return {
          key,
          title: 'Lesson',
          description: `${mod.lesson.length} short sections with worked examples.`,
          xp: 0,
          done,
          href: `#/learn/${mod.id}/lesson`,
        };
      case 'trainer': {
        const trainer = getTrainer(ref)!;
        return {
          key,
          title: trainer.title,
          description: `${trainer.problems} timed problems. Get ${trainer.target} right within ${trainer.limitMs / 60_000} minutes.`,
          xp: trainer.xp,
          done,
          href: '#/trainer',
        };
      }
      case 'quiz':
        return {
          key,
          title: 'Checkpoint quiz',
          description: `${mod.quiz.draw} questions from a pool of ${mod.quiz.questions.length}. Pass with ${mod.quiz.pass}.`,
          xp: mod.quiz.xp,
          done,
          href: `#/learn/${mod.id}/quiz`,
        };
      case 'practice':
      case 'challenge': {
        const lab = getLab(ref)!;
        return {
          key,
          title: `${key === 'practice' ? 'Guided practice' : 'Challenge'}: ${lab.title}`,
          description: lab.summary,
          xp: lab.xp,
          done,
          href: `#/lab/${lab.id}`,
        };
      }
    }
  });
}
