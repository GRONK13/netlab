import { loadConfig } from './config.ts';
import { connect, migrate } from './db.ts';

const config = loadConfig();
const db = await connect(config.databaseUrl, config.pgliteDir);
const applied = await migrate(db);
console.log(applied ? `Applied ${applied} migration(s).` : 'Database is up to date.');
await db.close();
