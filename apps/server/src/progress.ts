// Streaks, the weekly goal and badges. A practice day is a Manila calendar day, by the
// database clock, on which the server saw real work; the browser can't record one itself.
// Badges are decided by the shared rules in @netlab/modules and kept once earned.

import { LABS } from '@netlab/labs';
import {
  BADGES,
  dayNumber,
  doneFrom,
  earnedBadges,
  fromDayNumber,
  getTrainer,
  GOAL_MAX,
  GOAL_MIN,
  streakOf,
  weekOf,
  weekStart,
  type Streak,
  type Week,
} from '@netlab/modules';
import type { FastifyInstance } from 'fastify';
import { requireUser } from './auth.ts';
import { manilaDay, type Db } from './db.ts';

export interface Progress {
  today: string;
  streak: Streak;
  week: Week;
  badges: { id: string; earnedAt: string }[];
}

const BADGE_IDS = BADGES.map((b) => b.id);

export async function manilaToday(db: Db): Promise<string> {
  const [r] = await db.query<{ today: string }>(`select ${manilaDay('now()')}::text as today`);
  return r!.today;
}

/** Records the week as met if this week's practice days have reached the student's goal. */
async function checkGoal(db: Db, userId: number, day: string): Promise<void> {
  await db.query(
    `insert into goal_weeks (user_id, week, goal)
     select id, $2::date, weekly_goal from users
     where id = $1
       and (select count(*) from practice_days
            where user_id = $1 and day between $2::date and $2::date + 6) >= weekly_goal
     on conflict do nothing`,
    [userId, fromDayNumber(weekStart(dayNumber(day)))],
  );
}

/** Marks today as a practice day. Callers decide what counts as real work. */
export async function recordPractice(db: Db, userId: number): Promise<void> {
  const [added] = await db.query<{ day: string }>(
    `insert into practice_days (user_id, day) values ($1, ${manilaDay('now()')})
     on conflict do nothing returning day::text`,
    [userId],
  );
  if (added) await checkGoal(db, userId, added.day);
}

async function practiceDays(db: Db, userId: number): Promise<string[]> {
  const rows = await db.query<{ day: string }>(
    'select day::text as day from practice_days where user_id = $1',
    [userId],
  );
  return rows.map((r) => r.day);
}

/**
 * Awards every badge the student has earned but doesn't hold yet, and returns the new
 * ones in display order. Only graded events and the startup backfill call this, so a
 * page load never claims a badge before the event that earned it can report it.
 */
export async function syncBadges(db: Db, userId: number): Promise<string[]> {
  const [labs, steps, [more], longest, held] = await Promise.all([
    db.query<{ lab_id: string; hints_used: number }>(
      'select lab_id, hints_used from completions where user_id = $1',
      [userId],
    ),
    db.query<{ moduleId: string; step: string }>(
      'select module_id as "moduleId", step from module_steps where user_id = $1',
      [userId],
    ),
    db.query<{ perfect_quiz: boolean; fastest: number | null; goal_weeks: number }>(
      `select exists (select 1 from quiz_attempts where user_id = $1 and submitted_at is not null
                       and correct = jsonb_array_length(question_ids)) as perfect_quiz,
              (select min(duration_ms) from trainer_rounds where user_id = $1 and kind = 'subnetting'
                 and finished_at is not null and correct = $2) as fastest,
              (select count(*)::int from goal_weeks where user_id = $1) as goal_weeks`,
      [userId, getTrainer('subnetting')!.problems],
    ),
    Promise.all([practiceDays(db, userId), manilaToday(db)]).then(([d, t]) => streakOf(d, t).longest),
    db.query<{ badge_id: string }>('select badge_id from badges where user_id = $1', [userId]),
  ]);
  const earned = earnedBadges({
    done: doneFrom(labs.map((l) => l.lab_id), steps),
    noHintLabs: labs.filter((l) => l.hints_used === 0 && LABS.some((g) => g.id === l.lab_id)).length,
    perfectQuiz: more!.perfect_quiz,
    fastestPerfectRound: more!.fastest,
    longestStreak: longest,
    goalWeeks: more!.goal_weeks,
  });
  const holding = new Set(held.map((h) => h.badge_id));
  const missing = earned.filter((id) => !holding.has(id));
  if (missing.length === 0) return [];
  const added = await db.query<{ badge_id: string }>(
    `insert into badges (user_id, badge_id) select $1, unnest($2::text[])
     on conflict do nothing returning badge_id`,
    [userId, missing],
  );
  const fresh = new Set(added.map((a) => a.badge_id));
  return earned.filter((id) => fresh.has(id));
}

export async function progressFor(db: Db, userId: number): Promise<Progress> {
  const [[user], days] = await Promise.all([
    db.query<{ goal: number; today: string }>(
      `select weekly_goal as goal, ${manilaDay('now()')}::text as today from users where id = $1`,
      [userId],
    ),
    practiceDays(db, userId),
  ]);
  const { goal, today } = user!;
  const streak = streakOf(days, today);
  const badges = await db.query<{ badge_id: string; earned_at: string }>(
    'select badge_id, earned_at from badges where user_id = $1 and badge_id = any($2::text[]) order by earned_at, badge_id',
    [userId, BADGE_IDS],
  );
  return {
    today,
    streak,
    week: weekOf(days, today, goal),
    badges: badges.map((b) => ({ id: b.badge_id, earnedAt: b.earned_at })),
  };
}

/**
 * Awards badges earned before they existed, or under a rule added since. Rules only
 * change with a deploy, so running this at startup keeps everyone current. Returns how
 * many badges it awarded.
 */
export async function backfillBadges(db: Db): Promise<number> {
  const users = await db.query<{ id: number }>('select id from users');
  let awarded = 0;
  for (const u of users) awarded += (await syncBadges(db, u.id)).length;
  return awarded;
}

/** How many badges each of several students holds (the leaderboard). */
export async function badgeCounts(db: Db, userIds: number[]): Promise<Map<number, number>> {
  const rows = await db.query<{ user_id: number; n: number }>(
    `select user_id, count(*)::int as n from badges
     where user_id = any($1::int[]) and badge_id = any($2::text[]) group by user_id`,
    [userIds, BADGE_IDS],
  );
  return new Map(rows.map((r) => [r.user_id, r.n]));
}

/** Current streaks for several students at once (the leaderboard). */
export async function streaksFor(db: Db, userIds: number[]): Promise<Map<number, number>> {
  const [today, rows] = await Promise.all([
    manilaToday(db),
    db.query<{ user_id: number; day: string }>(
      'select user_id, day::text as day from practice_days where user_id = any($1::int[])',
      [userIds],
    ),
  ]);
  const byUser = new Map<number, string[]>();
  for (const r of rows) {
    const days = byUser.get(r.user_id);
    if (days) days.push(r.day);
    else byUser.set(r.user_id, [r.day]);
  }
  return new Map(userIds.map((id) => [id, streakOf(byUser.get(id) ?? [], today).current]));
}

export function progressRoutes(app: FastifyInstance, db: Db): void {
  app.put<{ Body: { days: number } }>(
    '/api/me/goal',
    {
      schema: {
        body: {
          type: 'object',
          required: ['days'],
          additionalProperties: false,
          properties: { days: { type: 'integer', minimum: GOAL_MIN, maximum: GOAL_MAX } },
        },
      },
    },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      await db.query('update users set weekly_goal = $2 where id = $1', [user.id, req.body.days]);
      // A week counts as met when practice reaches the goal, not when the goal comes down to it.
      return { week: weekOf(await practiceDays(db, user.id), await manilaToday(db), req.body.days) };
    },
  );
}
