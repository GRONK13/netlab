// The server the browser tests run against: the real app, plus a stand-in for Google and
// GitHub that signs in whoever the test registered last through POST /e2e/identity.
// It lives here, outside apps/server, so production can never offer it.

import { buildApp } from '../apps/server/src/app.ts';
import { loadConfig } from '../apps/server/src/config.ts';
import { connect, migrate } from '../apps/server/src/db.ts';
import { providersFrom, type Identity, type OAuthProvider } from '../apps/server/src/oauth.ts';

const config = loadConfig();
// A fresh in-memory database every run, so results don't depend on earlier runs (CI is the same).
const db = await connect();
await migrate(db);

let next: Identity | null = null;
const testProvider: OAuthProvider = {
  label: 'TestID',
  // Approves at once: straight back to our callback, like a provider the student already trusts.
  authorizeUrl: (state) => new URL(`/api/auth/test/callback?code=ok&state=${state}`, config.publicUrl),
  identity: async () => {
    if (!next) throw new Error('No test identity registered');
    const who = next;
    next = null;
    return who;
  },
};

// Real providers too when keys are set (the sign-in preview uses placeholders to show the buttons).
const app = await buildApp(db, config, { providers: { ...providersFrom(config), test: testProvider } });
app.post<{ Body: Identity }>('/e2e/identity', async (req) => {
  next = req.body;
  return { ok: true };
});
await app.listen({ port: config.port, host: config.host });
console.log(`NetLab test server on http://${config.host}:${config.port}`);
