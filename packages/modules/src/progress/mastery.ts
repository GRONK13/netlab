import { LABS, type CcnaDomain } from '@netlab/labs';
import { MODULES } from '../catalog.ts';
import { moduleSteps, type Done } from './steps.ts';

/** The six CCNA 200-301 exam domains and their share of the exam. */
export const CCNA_DOMAINS: { domain: CcnaDomain; weight: number }[] = [
  { domain: 'Network Fundamentals', weight: 20 },
  { domain: 'Network Access', weight: 20 },
  { domain: 'IP Connectivity', weight: 25 },
  { domain: 'IP Services', weight: 10 },
  { domain: 'Security Fundamentals', weight: 15 },
  { domain: 'Automation and Programmability', weight: 10 },
];

export interface DomainMastery {
  domain: CcnaDomain;
  /** Percent of the exam. */
  weight: number;
  done: number;
  /** 0 while NetLab has no content for the domain yet. */
  total: number;
}

/**
 * How much of each domain's content a student has finished. Every module step counts
 * toward its module's domain, and a graded lab outside any module counts toward its own.
 */
export function masteryByDomain(done: Done): DomainMastery[] {
  const rows = CCNA_DOMAINS.map((d) => ({ ...d, done: 0, total: 0 }));
  const add = (domain: CcnaDomain, finished: boolean) => {
    const row = rows.find((r) => r.domain === domain)!;
    row.total++;
    if (finished) row.done++;
  };
  const inModules = new Set<string>();
  for (const mod of MODULES) {
    for (const s of moduleSteps(mod, done)) {
      add(mod.ccnaDomain, s.done);
      if (s.key === 'practice' || s.key === 'challenge') inModules.add(s.ref);
    }
  }
  for (const lab of LABS) if (!inModules.has(lab.id)) add(lab.ccnaDomain, done.labs.has(lab.id));
  return rows;
}
