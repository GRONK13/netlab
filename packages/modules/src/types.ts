import type { CcnaDomain } from '@netlab/labs';

/** Interactive blocks a lesson can embed with a `::: name args` line. */
export const WIDGETS = ['subnet-explorer'] as const;
export type WidgetName = (typeof WIDGETS)[number];

export interface LessonSection {
  /** Anchor for the table of contents. */
  id: string;
  title: string;
  /**
   * Lesson markdown: paragraphs, `### ` subheadings, "- " and "1. " lists, tables,
   * fenced code, `> ` tips, `code` and **bold**, and `::: widget args` lines.
   */
  body: string;
}

export type Question =
  | { id: string; kind: 'choice'; prompt: string; choices: string[] }
  | {
      id: string;
      kind: 'input';
      prompt: string;
      answerType: 'ip' | 'number' | 'text';
      placeholder?: string;
    };

export interface Quiz {
  /** The pool. Answers live in `@netlab/modules/answers`, which only the server imports. */
  questions: Question[];
  /** Questions per attempt, drawn at random from the pool. */
  draw: number;
  /** Correct answers needed to pass. */
  pass: number;
  xp: number;
}

export interface Module {
  id: string;
  number: number;
  title: string;
  summary: string;
  ccnaDomain: CcnaDomain;
  lesson: LessonSection[];
  /** Guided practice lab id, if the module has one. */
  practice?: string;
  /** Speed trainer kind, if the module has one. */
  trainer?: string;
  quiz: Quiz;
  /** Graded challenge lab id, if the module has one. */
  challenge?: string;
}
