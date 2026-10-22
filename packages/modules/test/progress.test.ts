import { describe, expect, it } from 'vitest';
import { LABS } from '@netlab/labs';
import {
  BADGES,
  CCNA_DOMAINS,
  dayNumber,
  doneFrom,
  earnedBadges,
  fromDayNumber,
  getBadge,
  masteryByDomain,
  MODULES,
  moduleSteps,
  SPRINT_MS,
  streakOf,
  weekOf,
  weekStart,
  type BadgeStats,
  type Module,
} from '../src/index.ts';

// 2026-10-19 is a Monday, so "today" (Wednesday 2026-10-21) is in the week of the 19th.
const TODAY = '2026-10-21';

describe('days', () => {
  it('round-trips dates, leap days included', () => {
    for (const day of ['1970-01-01', '2026-10-21', '2028-02-29', '2030-12-31']) {
      expect(fromDayNumber(dayNumber(day))).toBe(day);
    }
    expect(dayNumber('2026-03-01') - dayNumber('2026-02-28')).toBe(1);
  });

  it('starts weeks on Monday', () => {
    const monday = dayNumber('2026-10-19');
    for (const day of ['2026-10-19', '2026-10-21', '2026-10-25']) {
      expect(weekStart(dayNumber(day))).toBe(monday);
    }
    expect(fromDayNumber(weekStart(dayNumber('2026-10-18')))).toBe('2026-10-12');
    expect(fromDayNumber(weekStart(dayNumber('2026-10-26')))).toBe('2026-10-26');
  });
});

describe('streaks', () => {
  it('is zero with no practice', () => {
    expect(streakOf([], TODAY)).toEqual({ current: 0, longest: 0, practicedToday: false, freeMissUsed: false });
  });

  it('counts today', () => {
    expect(streakOf([TODAY], TODAY)).toEqual({ current: 1, longest: 1, practicedToday: true, freeMissUsed: false });
  });

  it("doesn't break while today is still pending", () => {
    const s = streakOf(['2026-10-19', '2026-10-20'], TODAY);
    expect(s).toMatchObject({ current: 2, practicedToday: false, freeMissUsed: false });
  });

  it('forgives one missed day a week, without counting it', () => {
    expect(streakOf(['2026-10-19', '2026-10-21'], TODAY)).toMatchObject({ current: 2, freeMissUsed: true });
    // Missed yesterday, nothing yet today: still alive on the free miss.
    expect(streakOf(['2026-10-19'], TODAY)).toMatchObject({ current: 1, freeMissUsed: true });
  });

  it('ends on a second miss in the same week', () => {
    // Mon, (Tue missed: forgiven), Wed, (Thu missed: breaks), Fri.
    const s = streakOf(['2026-10-19', '2026-10-21', '2026-10-23'], '2026-10-23');
    expect(s).toMatchObject({ current: 1, longest: 2 });
    // Two misses in a row in one week, with today pending. The saver went on a run
    // that has ended, so it doesn't show as used.
    expect(streakOf(['2026-10-19'], '2026-10-22')).toMatchObject({ current: 0, freeMissUsed: false });
  });

  it('forgives a Sunday and the Monday after it, one from each week', () => {
    const s = streakOf(['2026-10-17', '2026-10-20'], '2026-10-20');
    expect(s).toMatchObject({ current: 2, freeMissUsed: true });
  });

  it('remembers the longest run after a break', () => {
    const run = Array.from({ length: 10 }, (_, i) => fromDayNumber(dayNumber('2026-10-01') + i));
    const s = streakOf([...run, '2026-10-20', TODAY], TODAY);
    expect(s).toMatchObject({ current: 2, longest: 10 });
  });

  it('ignores duplicates and days after today', () => {
    expect(streakOf([TODAY, TODAY, '2026-10-22'], TODAY)).toMatchObject({ current: 1, longest: 1 });
  });
});

describe('weekly goal', () => {
  it('lays the week out Monday to Sunday', () => {
    const w = weekOf(['2026-10-18', '2026-10-19', TODAY], TODAY, 3);
    expect(w).toEqual({
      start: '2026-10-19',
      days: [true, false, true, false, false, false, false],
      count: 2,
      goal: 3,
      met: false,
    });
  });

  it('is met once the practice days reach the goal', () => {
    expect(weekOf(['2026-10-19', '2026-10-20', TODAY], TODAY, 3).met).toBe(true);
    const sunday = weekOf(['2026-10-25'], '2026-10-25', 2);
    expect(sunday.days[6]).toBe(true);
    expect(sunday.met).toBe(false);
  });
});

const none = doneFrom([], []);
// Every step of these modules, finished.
const doneWith = (mods: Module[]) => {
  const steps = mods.flatMap((mod) => moduleSteps(mod, none).map((s) => ({ mod, s })));
  const isLab = ({ s }: (typeof steps)[number]) => s.key === 'practice' || s.key === 'challenge';
  return doneFrom(
    steps.filter(isLab).map(({ s }) => s.ref),
    steps.filter((x) => !isLab(x)).map(({ mod, s }) => ({ moduleId: mod.id, step: s.key })),
  );
};
const stats = (over: Partial<BadgeStats> = {}): BadgeStats => ({
  done: none,
  noHintLabs: 0,
  perfectQuiz: false,
  fastestPerfectRound: null,
  longestStreak: 0,
  goalWeeks: 0,
  ...over,
});

describe('module steps', () => {
  it("lists each module's steps in order", () => {
    const [m1, m2] = MODULES;
    expect(moduleSteps(m1!, none).map((s) => s.key)).toEqual(['lesson', 'practice', 'trainer', 'quiz', 'challenge']);
    expect(moduleSteps(m2!, none).map((s) => s.key)).toEqual(['lesson', 'practice', 'quiz', 'challenge']);
    const done = doneFrom(['ip-practice'], [{ moduleId: 'ip-addressing', step: 'quiz' }]);
    expect(moduleSteps(m1!, done).filter((s) => s.done).map((s) => s.key)).toEqual(['practice', 'quiz']);
  });
});

describe('mastery', () => {
  it('covers all six CCNA domains, and the weights add up to 100%', () => {
    const rows = masteryByDomain(none);
    expect(rows.map((r) => r.domain)).toEqual(CCNA_DOMAINS.map((d) => d.domain));
    expect(CCNA_DOMAINS.reduce((n, d) => n + d.weight, 0)).toBe(100);
  });

  it('counts each module step toward its domain, and nothing for empty domains yet', () => {
    // Graded labs that aren't a module's practice or challenge count on their own.
    const outside = LABS.filter((l) => !MODULES.some((m) => m.challenge === l.id || m.practice === l.id));
    for (const row of masteryByDomain(none)) {
      const steps = MODULES.filter((m) => m.ccnaDomain === row.domain).reduce(
        (n, m) => n + moduleSteps(m, none).length,
        0,
      );
      expect(row.total).toBe(steps + outside.filter((l) => l.ccnaDomain === row.domain).length);
      expect(row.done).toBe(0);
    }
    const totals = Object.fromEntries(masteryByDomain(none).map((r) => [r.domain, r.total]));
    expect(totals).toMatchObject({ 'IP Services': 0, 'Automation and Programmability': 0 });
  });

  it('counts what is done', () => {
    const rows = masteryByDomain(doneWith([MODULES[0]!]));
    const fundamentals = rows.find((r) => r.domain === 'Network Fundamentals')!;
    expect(fundamentals.done).toBe(fundamentals.total);
    expect(rows.find((r) => r.domain === 'Network Access')!.done).toBe(0);
  });
});

describe('badges', () => {
  it('have unique ids, names, descriptions and icons, and one per module', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    expect(new Set(BADGES.map((b) => b.name)).size).toBe(BADGES.length);
    for (const b of BADGES) {
      expect(b.description).toMatch(/^[A-Z].*\.$/);
      expect(b.icon).toBeTruthy();
    }
    for (const m of MODULES) expect(getBadge(`module-${m.id}`)).toBeDefined();
  });

  it('starts with none', () => {
    expect(earnedBadges(stats())).toEqual([]);
  });

  it('awards each rule', () => {
    expect(earnedBadges(stats({ done: doneFrom(['ip-practice'], []) }))).toEqual(['first-link']);
    expect(earnedBadges(stats({ done: doneWith([MODULES[1]!]) }))).toEqual(['first-link', 'module-switching-vlans']);
    expect(earnedBadges(stats({ done: doneWith(MODULES) }))).toEqual([
      'first-link',
      ...MODULES.map((m) => `module-${m.id}`),
      'core-complete',
    ]);
    expect(earnedBadges(stats({ perfectQuiz: true }))).toEqual(['ten-for-ten']);
    expect(earnedBadges(stats({ noHintLabs: 1 }))).toEqual(['no-hints']);
    expect(earnedBadges(stats({ fastestPerfectRound: SPRINT_MS - 1 }))).toEqual(['subnet-sprinter']);
    expect(earnedBadges(stats({ fastestPerfectRound: SPRINT_MS }))).toEqual([]);
    expect(earnedBadges(stats({ longestStreak: 2 }))).toEqual([]);
    expect(earnedBadges(stats({ longestStreak: 7 }))).toEqual(['streak-3', 'streak-7']);
    expect(earnedBadges(stats({ longestStreak: 30 }))).toEqual(['streak-3', 'streak-7', 'streak-30']);
    expect(earnedBadges(stats({ goalWeeks: 3 }))).toEqual(['goal-met']);
    expect(earnedBadges(stats({ goalWeeks: 4 }))).toEqual(['goal-met', 'goal-4']);
  });
});
