import { dayNumber, weekStart } from './days.ts';

export interface Streak {
  /** Practice days in the current run. A forgiven miss keeps it alive but doesn't add to it. */
  current: number;
  longest: number;
  practicedToday: boolean;
  /** This week's one free miss has been spent on the current run. */
  freeMissUsed: boolean;
}

/**
 * The daily streak on `today`, from the days a student practised. Each Monday-to-Sunday
 * week forgives one missed day; a second miss in the same week ends the run. Today
 * hasn't ended yet, so not having practised today never breaks it.
 */
export function streakOf(days: readonly string[], today: string): Streak {
  const t = dayNumber(today);
  const practised = new Set(days.map(dayNumber).filter((n) => n <= t));
  let first = t;
  for (const n of practised) if (n < first) first = n;

  let run = 0;
  let longest = 0;
  let forgivenWeek: number | null = null;
  for (let d = first; d < t; d++) {
    if (practised.has(d)) {
      run++;
      longest = Math.max(longest, run);
    } else if (run > 0 && forgivenWeek !== weekStart(d)) {
      forgivenWeek = weekStart(d);
    } else {
      run = 0;
    }
  }
  const practicedToday = practised.has(t);
  if (practicedToday) {
    run++;
    longest = Math.max(longest, run);
  }
  return { current: run, longest, practicedToday, freeMissUsed: run > 0 && forgivenWeek === weekStart(t) };
}
