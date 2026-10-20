import type { Question } from '../types.ts';
import { sameIp, sameNumber } from '../normalize.ts';

export interface AnswerKey {
  /** Choice index for choice questions; the canonical answer for input questions. */
  answer: number | string;
  /** Shown only after the student passes. */
  explanation: string;
}

export type AnswerKeys = Record<string, AnswerKey>;

export function grade(q: Question, key: AnswerKey, given: string): boolean {
  if (q.kind === 'choice') return given.trim() === String(key.answer);
  const expected = String(key.answer);
  switch (q.answerType) {
    case 'ip':
      return sameIp(given, expected);
    case 'number':
      return sameNumber(given, expected);
    case 'text':
      return given.replace(/\s/g, '').toLowerCase() === expected.replace(/\s/g, '').toLowerCase();
  }
}

/** The correct answer as the student should see it. */
export function answerText(q: Question, key: AnswerKey): string {
  return q.kind === 'choice' ? (q.choices[Number(key.answer)] ?? '') : String(key.answer);
}
