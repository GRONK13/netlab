// Quiz answer keys, exported as `@netlab/modules/answers`. Only the server and tests
// import this; a test fails if anything under apps/web does, so keys never reach a browser.

import { deviceSecurityAnswers } from './device-security.ts';
import { interVlanRoutingAnswers } from './inter-vlan-routing.ts';
import { ipAddressingAnswers } from './ip-addressing.ts';
import { switchingVlansAnswers } from './switching-vlans.ts';
import type { AnswerKeys } from './grade.ts';

export const ANSWERS: Record<string, AnswerKeys> = {
  'ip-addressing': ipAddressingAnswers,
  'switching-vlans': switchingVlansAnswers,
  'inter-vlan-routing': interVlanRoutingAnswers,
  'device-security': deviceSecurityAnswers,
};

export { grade, answerText, type AnswerKey, type AnswerKeys } from './grade.ts';
