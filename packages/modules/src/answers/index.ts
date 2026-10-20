// Quiz answer keys, exported as `@netlab/modules/answers`. Only the server and tests
// import this; a test fails if anything under apps/web does, so keys never reach a browser.

import { ipAddressingAnswers } from './ip-addressing.ts';
import type { AnswerKeys } from './grade.ts';

export const ANSWERS: Record<string, AnswerKeys> = {
  'ip-addressing': ipAddressingAnswers,
};

export { grade, answerText, type AnswerKey, type AnswerKeys } from './grade.ts';
