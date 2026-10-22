// A tiny database layer: plain SQL over either node-postgres (production) or
// PGlite (embedded Postgres for local dev and tests). Both speak the same SQL.

import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

export interface Db {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs one or more statements without parameters. */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export async function connect(databaseUrl?: string, pgliteDir?: string): Promise<Db> {
  if (databaseUrl) {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return {
      async query<T>(sql: string, params: unknown[] = []) {
        return (await pool.query(sql, params)).rows as T[];
      },
      async exec(sql) {
        await pool.query(sql);
      },
      close: () => pool.end(),
    };
  }
  if (pgliteDir) mkdirSync(pgliteDir, { recursive: true });
  const lite = pgliteDir ? new PGlite(pgliteDir) : new PGlite();
  await lite.waitReady;
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await lite.query<T>(sql, params)).rows;
    },
    async exec(sql) {
      await lite.exec(sql);
    },
    close: () => lite.close(),
  };
}

/**
 * The Manila calendar day of a timestamp, as SQL. Manila is UTC+8 with no daylight
 * saving, so a fixed offset is exact and doesn't need timezone data.
 */
export const manilaDay = (ts: string) => `((${ts} at time zone 'UTC') + interval '8 hours')::date`;

/** Schema changes, applied in order and recorded in schema_migrations. Append only. */
const MIGRATIONS: string[] = [
  `
  create table users (
    id serial primary key,
    email text not null unique,
    display_name text not null,
    password_hash text not null,
    role text not null default 'student',
    created_at timestamptz not null default now()
  );
  create table sessions (
    token_hash text primary key,
    user_id integer not null references users(id) on delete cascade,
    expires_at timestamptz not null
  );
  create index sessions_user_idx on sessions(user_id);
  create table attempts (
    user_id integer not null references users(id) on delete cascade,
    lab_id text not null,
    command_log jsonb not null default '[]',
    hints_used integer not null default 0,
    updated_at timestamptz not null default now(),
    primary key (user_id, lab_id)
  );
  create table completions (
    user_id integer not null references users(id) on delete cascade,
    lab_id text not null,
    xp_awarded integer not null,
    hints_used integer not null,
    completed_at timestamptz not null default now(),
    primary key (user_id, lab_id)
  );
  `,
  `
  create table sandboxes (
    user_id integer primary key references users(id) on delete cascade,
    data jsonb not null,
    updated_at timestamptz not null default now()
  );
  `,
  `
  create table module_steps (
    user_id integer not null references users(id) on delete cascade,
    module_id text not null,
    step text not null check (step in ('lesson', 'trainer', 'quiz')),
    xp_awarded integer not null default 0,
    completed_at timestamptz not null default now(),
    primary key (user_id, module_id, step)
  );
  create table trainer_rounds (
    id serial primary key,
    user_id integer not null references users(id) on delete cascade,
    kind text not null,
    seed integer not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    correct integer,
    duration_ms integer
  );
  create index trainer_rounds_user_idx on trainer_rounds(user_id, kind);
  -- Every XP award, whatever earned it. Totals, levels and the leaderboard read this.
  create view xp_events as
    select user_id, 'lab' as source, lab_id as ref, xp_awarded as xp, completed_at as at from completions
    union all
    select user_id, 'module:' || step, module_id, xp_awarded, completed_at from module_steps;
  `,
  `
  create table quiz_attempts (
    id serial primary key,
    user_id integer not null references users(id) on delete cascade,
    module_id text not null,
    question_ids jsonb not null,
    correct integer,
    passed boolean,
    started_at timestamptz not null default now(),
    submitted_at timestamptz
  );
  create index quiz_attempts_user_idx on quiz_attempts(user_id, module_id);
  `,
  `
  -- Streaks and weekly goals: one row per Manila day with real practice.
  create table practice_days (
    user_id integer not null references users(id) on delete cascade,
    day date not null,
    primary key (user_id, day)
  );
  -- Weeks (by their Monday) in which the student reached the goal they had then.
  create table goal_weeks (
    user_id integer not null references users(id) on delete cascade,
    week date not null,
    goal smallint not null,
    primary key (user_id, week)
  );
  alter table users add column weekly_goal smallint not null default 3 check (weekly_goal between 2 and 5);
  insert into practice_days (user_id, day)
    select distinct user_id, ${manilaDay('ts')} from (
      select user_id, completed_at as ts from completions
      union all select user_id, completed_at from module_steps
      union all select user_id, finished_at from trainer_rounds where finished_at is not null and correct > 0
      union all select user_id, submitted_at from quiz_attempts where submitted_at is not null and correct > 0
    ) work
    on conflict do nothing;
  `,
  `
  -- Cosmetic badges, kept once earned. The rules live in @netlab/modules.
  create table badges (
    user_id integer not null references users(id) on delete cascade,
    badge_id text not null,
    earned_at timestamptz not null default now(),
    primary key (user_id, badge_id)
  );
  `,
  `
  -- Public sign-in with Google and GitHub. Their accounts have no password.
  alter table users alter column password_hash drop not null;
  alter table users add column hidden boolean not null default false;
  create table oauth_accounts (
    provider text not null,
    subject text not null,
    user_id integer not null references users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (provider, subject)
  );
  create index oauth_accounts_user_idx on oauth_accounts(user_id);
  -- A first sign-in waiting for the student to choose a display name.
  create table pending_signups (
    token_hash text primary key,
    provider text not null,
    subject text not null,
    email text not null,
    suggested_name text not null,
    expires_at timestamptz not null
  );
  `,
];

export async function migrate(db: Db): Promise<number> {
  await db.exec(
    'create table if not exists schema_migrations (version integer primary key, applied_at timestamptz not null default now())',
  );
  const done = new Set(
    (await db.query<{ version: number }>('select version from schema_migrations')).map((r) => r.version),
  );
  let applied = 0;
  for (const [i, sql] of MIGRATIONS.entries()) {
    const version = i + 1;
    if (done.has(version)) continue;
    await db.exec(`begin; ${sql}; insert into schema_migrations (version) values (${version}); commit;`);
    applied++;
  }
  return applied;
}
