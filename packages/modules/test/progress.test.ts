import { describe, expect, it } from 'vitest';
import { dayNumber, fromDayNumber, streakOf, weekOf, weekStart } from '../src/index.ts';

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
