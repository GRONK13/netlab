import { dayNumber, fromDayNumber, weekStart } from './days.ts';

/** Students pick how many days a week they mean to practise. */
export const GOAL_MIN = 2;
export const GOAL_MAX = 5;
export const GOAL_DEFAULT = 3;

export interface Week {
  /** The Monday this week starts on. */
  start: string;
  /** Monday to Sunday: practised that day or not. */
  days: boolean[];
  count: number;
  goal: number;
  met: boolean;
}

export function weekOf(days: readonly string[], today: string, goal: number): Week {
  const start = weekStart(dayNumber(today));
  const practised = new Set(days.map(dayNumber));
  const strip = Array.from({ length: 7 }, (_, i) => practised.has(start + i));
  const count = strip.filter(Boolean).length;
  return { start: fromDayNumber(start), days: strip, count, goal, met: count >= goal };
}
