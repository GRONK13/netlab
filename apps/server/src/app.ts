import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { authRoutes, loadUser } from './auth.ts';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { moduleRoutes } from './modules.ts';
import { progressRoutes } from './progress.ts';
import { apiRoutes } from './routes.ts';
import { trainerRoutes } from './trainer.ts';

/** The deployed git commit, so `/api/health` shows which version is live. */
const COMMIT = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
})();

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'same-origin',
  'content-security-policy':
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

export async function buildApp(db: Db, config: Config): Promise<FastifyInstance> {
  // Apache sits in front on the school server, so trust its X-Forwarded-* headers.
  const app = Fastify({ trustProxy: true, bodyLimit: 2 * 1024 * 1024, logger: config.production });

  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    // CSRF protection: state-changing calls must be same-origin JSON.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const type = req.headers['content-type'] ?? '';
      if (!type.startsWith('application/json')) return reply.code(415).send({ error: 'Send JSON.' });
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.host) return reply.code(403).send({ error: 'Cross-site request.' });
    }
    req.user = await loadUser(db, req);
  });
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.headers(SECURITY_HEADERS);
    return payload;
  });

  authRoutes(app, db, config);
  apiRoutes(app, db);
  trainerRoutes(app, db);
  moduleRoutes(app, db);
  progressRoutes(app, db);
  app.get('/api/health', async () => ({ ok: true, commit: COMMIT }));

  if (existsSync(config.webDist)) {
    await app.register(fastifyStatic, { root: config.webDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found.' });
      return reply.sendFile('index.html');
    });
  }
  return app;
}
