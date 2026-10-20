import type { Check, TopologySpec } from '@netlab/sim';

export type CcnaDomain =
  | 'Network Fundamentals'
  | 'Network Access'
  | 'IP Connectivity'
  | 'IP Services'
  | 'Security Fundamentals'
  | 'Automation and Programmability';

export interface Objective {
  label: string;
  check: Check;
  /** Guided labs: why this works, shown once the step is met. */
  why?: string;
}

export interface Lab {
  id: string;
  title: string;
  summary: string;
  ccnaDomain: CcnaDomain;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  xp: number;
  /** Lightweight markdown: paragraphs, "- " lists, **bold**, `code`. */
  briefing: string;
  topology: TopologySpec;
  objectives: Objective[];
  /** Revealed one at a time; each costs 10% of the lab's XP. */
  hints: string[];
  /** Guided practice: objectives appear one at a time, in order, with explanations. */
  guided?: boolean;
}
