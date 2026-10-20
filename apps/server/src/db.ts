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
