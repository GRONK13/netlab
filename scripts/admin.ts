// Leaderboard moderation for netlab.dcism.org, run by hand on the server:
//   node scripts/admin.ts find <text>              accounts whose email or name contains text
//   node scripts/admin.ts rename <email|id> <name> change a display name
//   node scripts/admin.ts hide <email|id>          keep the account off the leaderboard
//   node scripts/admin.ts unhide <email|id>
//
// DATABASE_URL comes from .env (never printed). Without it, the local PGlite database
// in .data/pglite is used; stop the dev server first, since PGlite allows one process.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUsers, renameUser, setHidden, type AdminUser } from '../apps/server/src/admin.ts';
import { connect } from '../apps/server/src/db.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  process.loadEnvFile(join(root, '.env'));
} catch {
  // No .env: local development.
}

const show = (u: AdminUser) =>
  `${String(u.id).padStart(5)}  ${u.display_name.padEnd(24)} ${u.email}${u.hidden ? '  (hidden)' : ''}`;

const [command, who, ...rest] = process.argv.slice(2);
const usage = 'Usage: node scripts/admin.ts find <text> | rename <email|id> <name> | hide <email|id> | unhide <email|id>';

const db = await connect(process.env.DATABASE_URL || undefined, process.env.PGLITE_DIR ?? join(root, '.data/pglite'));
try {
  if (command === 'find' && who) {
    const users = await findUsers(db, [who, ...rest].join(' '));
    console.log(users.length ? users.map(show).join('\n') : 'No accounts match.');
  } else if (command === 'rename' && who && rest.length) {
    console.log(`Renamed:\n${show(await renameUser(db, who, rest.join(' ')))}`);
  } else if ((command === 'hide' || command === 'unhide') && who) {
    console.log(`${command === 'hide' ? 'Hidden' : 'Shown again'}:\n${show(await setHidden(db, who, command === 'hide'))}`);
  } else {
    console.log(usage);
    process.exitCode = 1;
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await db.close();
}
