import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { connect, migrate } from './db.ts';
import { backfillBadges } from './progress.ts';

const config = loadConfig();
if (config.allowedEmailDomains.length === 0) {
  console.warn('ALLOWED_EMAIL_DOMAIN is not set: anyone with any email can register.');
}

const db = await connect(config.databaseUrl, config.pgliteDir);
await migrate(db);
const app = await buildApp(db, config);

const shutdown = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.port, host: config.host });
console.log(`NetLab server on http://${config.host}:${config.port} (${config.databaseUrl ? 'Postgres' : 'PGlite'})`);

// Badges are cosmetic: catch them up in the background, and never fail startup over them.
backfillBadges(db).then(
  (n) => n > 0 && console.log(`Awarded ${n} badges earned before this version.`),
  (e: unknown) => console.error('Badge backfill failed:', e),
);
