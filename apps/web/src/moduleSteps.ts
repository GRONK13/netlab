import { getLab } from '@netlab/labs';
import { getTrainer, type Module } from '@netlab/modules';
import type { Me } from './api.ts';

export interface Step {
  key: 'lesson' | 'practice' | 'trainer' | 'quiz' | 'challenge';
  title: string;
  description: string;
  xp: number;
  done: boolean;
  href: string;
}

/** A module's steps in order, with this student's progress. Steps a module doesn't have are left out. */
export function stepsFor(mod: Module, me: Me): Step[] {
  const stepDone = (step: string) =>
    me.moduleSteps.some((s) => s.moduleId === mod.id && s.step === step);
  const labDone = (id: string) => me.completions.some((c) => c.labId === id);
  const steps: Step[] = [
    {
      key: 'lesson',
      title: 'Lesson',
      description: `${mod.lesson.length} short sections with worked examples.`,
      xp: 0,
      done: stepDone('lesson'),
      href: `#/learn/${mod.id}/lesson`,
    },
  ];
  const practice = mod.practice ? getLab(mod.practice) : undefined;
  if (practice) {
    steps.push({
      key: 'practice',
      title: `Guided practice: ${practice.title}`,
      description: practice.summary,
      xp: practice.xp,
      done: labDone(practice.id),
      href: `#/lab/${practice.id}`,
    });
  }
  const trainer = mod.trainer ? getTrainer(mod.trainer) : undefined;
  if (trainer) {
    steps.push({
      key: 'trainer',
      title: trainer.title,
      description: `${trainer.problems} timed problems. Get ${trainer.target} right within ${trainer.limitMs / 60_000} minutes.`,
      xp: trainer.xp,
      done: stepDone('trainer'),
      href: '#/trainer',
    });
  }
  steps.push({
    key: 'quiz',
    title: 'Checkpoint quiz',
    description: `${mod.quiz.draw} questions from a pool of ${mod.quiz.questions.length}. Pass with ${mod.quiz.pass}.`,
    xp: mod.quiz.xp,
    done: stepDone('quiz'),
    href: `#/learn/${mod.id}/quiz`,
  });
  const challenge = mod.challenge ? getLab(mod.challenge) : undefined;
  if (challenge) {
    steps.push({
      key: 'challenge',
      title: `Challenge: ${challenge.title}`,
      description: challenge.summary,
      xp: challenge.xp,
      done: labDone(challenge.id),
      href: `#/lab/${challenge.id}`,
    });
  }
  return steps;
}
