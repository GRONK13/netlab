// Streaks and the weekly goal. A practice day is a Manila calendar day, by the database
// clock, on which the server saw real work; the browser can't record one itself.

import {
  dayNumber,
  fromDayNumber,
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
}

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

export async function progressFor(db: Db, userId: number): Promise<Progress> {
  const [[user], days] = await Promise.all([
    db.query<{ goal: number; today: string }>(
      `select weekly_goal as goal, ${manilaDay('now()')}::text as today from users where id = $1`,
      [userId],
    ),
    practiceDays(db, userId),
  ]);
  const { goal, today } = user!;
  return { today, streak: streakOf(days, today), week: weekOf(days, today, goal) };
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
