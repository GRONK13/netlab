// Proves a backup actually restores: loads it into a throwaway in-memory PGlite
// and counts the rows in every table. Run weekly by cron after the backup:
//   45 2 * * 0 cd $HOME/netlab.dcism.org && node scripts/restore-check.ts >> .data/backup.log 2>&1
// or by hand:
//   node scripts/restore-check.ts                      newest file in ~/backups/netlab
//   node scripts/restore-check.ts path/to/file.sql.gz  a specific backup

import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const REQUIRED = ['schema_migrations', 'users', 'sessions', 'attempts', 'completions'];

const log = (msg: string) => console.log(`${new Date().toISOString()} ${msg}`);

function newest(): string | undefined {
  const dir = process.env.BACKUP_DIR ?? join(homedir(), 'backups', 'netlab');
  try {
    const last = readdirSync(dir)
      .filter((f) => /^netlab-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(f))
      .sort()
      .at(-1);
    return last && join(dir, last);
  } catch {
    return undefined;
  }
}

const file = process.argv[2] ?? newest();
if (!file) {
  log('Restore check failed: no backup found');
  process.exit(1);
}

try {
  const sql = gunzipSync(readFileSync(file))
    .toString('utf8')
    .split('\n')
    // psql meta-commands (pg_dump 17.6+ wraps dumps in \restrict ... \unrestrict) aren't SQL.
    // Match only those two, so data lines that happen to start with a backslash survive.
    .filter((line) => !/^\\(un)?restrict /.test(line))
    .join('\n');
  const db = new PGlite();
  await db.exec(sql);
  // The dump empties search_path, so name the schema explicitly.
  const tables = (
    await db.query<{ name: string }>(
      `select table_name as name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`,
    )
  ).rows.map((r) => r.name);
  const missing = REQUIRED.filter((t) => !tables.includes(t));
  if (missing.length > 0) throw new Error(`missing tables: ${missing.join(', ')}`);
  const counts: string[] = [];
  for (const t of tables) {
    const [row] = (await db.query<{ n: number }>(`select count(*)::int as n from public."${t}"`))
      .rows;
    counts.push(`${t} ${row?.n ?? 0}`);
  }
  await db.close();
  log(`Restore check passed for ${file}: ${counts.join(', ')}`);
} catch (e) {
  log(`Restore check FAILED for ${file}: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
