// Nightly database backup for netlab.dcism.org, run by cron:
//   30 2 * * * cd $HOME/netlab.dcism.org && node scripts/backup.ts >> .data/backup.log 2>&1
//
// Writes ~/backups/netlab/netlab-YYYY-MM-DD.sql.gz and keeps the newest 14.
// The dump is plain SQL with INSERTs (no COPY), so it restores into Postgres
// with psql and into an in-memory PGlite with scripts/restore-check.ts.
//
// DATABASE_URL comes from .env. Its parts reach pg_dump as libpq environment
// variables, so the password never shows up in `ps` or in the log.

import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = process.env.BACKUP_DIR ?? join(homedir(), 'backups', 'netlab');
const keep = Number(process.env.BACKUP_KEEP ?? 14);

const log = (msg: string) => console.log(`${new Date().toISOString()} ${msg}`);

try {
  process.loadEnvFile(join(root, '.env'));
} catch (e) {
  log(`Backup failed: can't read .env (${e instanceof Error ? e.message : String(e)})`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  log('Backup failed: DATABASE_URL is not set in .env');
  process.exit(1);
}
const url = new URL(process.env.DATABASE_URL);
const env: NodeJS.ProcessEnv = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
};
delete env.DATABASE_URL;
const sslmode = url.searchParams.get('sslmode');
if (sslmode) env.PGSSLMODE = sslmode;

const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const name = `netlab-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.sql.gz`;
const file = join(dir, name);
const tmp = `${file}.partial`;

// Backups hold password hashes and student emails: readable by this user only.
process.umask(0o077);
mkdirSync(dir, { recursive: true });

const dump = spawn('pg_dump', ['--no-owner', '--no-privileges', '--rows-per-insert=500'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
dump.stderr.on('data', (chunk: Buffer) => (stderr += chunk));
const exited = new Promise<number | null>((resolve, reject) => {
  dump.on('error', reject);
  dump.on('close', resolve);
});

try {
  // Await both together, so a spawn error (e.g. pg_dump not on PATH) can't go unhandled.
  const [, code] = await Promise.all([
    pipeline(dump.stdout, createGzip(), createWriteStream(tmp)),
    exited,
  ]);
  if (code !== 0) throw new Error(stderr.trim() || `pg_dump exited with ${code}`);
} catch (e) {
  rmSync(tmp, { force: true });
  log(`Backup failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
renameSync(tmp, file);

// Dated names sort oldest first.
const backups = readdirSync(dir)
  .filter((f) => /^netlab-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(f))
  .sort();
for (const old of backups.slice(0, Math.max(0, backups.length - keep))) rmSync(join(dir, old));

log(
  `Backed up to ${file} (${Math.ceil(statSync(file).size / 1024)} KB, keeping ${Math.min(backups.length, keep)})`,
);
