import type { Question } from '../types.ts';
import { sameIp, sameNumber } from '../normalize.ts';

export interface AnswerKey {
  /** Choice index for choice questions; the canonical answer for input questions. */
  answer: number | string;
  /** Text questions: other wordings that also count as right. */
  alsoAccept?: string[];
  /** Shown only after the student passes. */
  explanation: string;
}

const squash = (s: string) => s.replace(/\s/g, '').toLowerCase();

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
      return [expected, ...(key.alsoAccept ?? [])].some((a) => squash(a) === squash(given));
  }
}

/** The correct answer as the student should see it. */
export function answerText(q: Question, key: AnswerKey): string {
  return q.kind === 'choice' ? (q.choices[Number(key.answer)] ?? '') : String(key.answer);
}
