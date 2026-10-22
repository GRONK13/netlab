import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from './config.ts';
import type { Db } from './db.ts';

export const SESSION_COOKIE = 'netlab_sid';
const SESSION_DAYS = 30;

export interface User {
  id: number;
  email: string;
  displayName: string;
  role: 'student' | 'instructor';
}

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
  }
}

// OWASP's recommended argon2id settings.
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function emailAllowed(email: string, domains: string[]): boolean {
  if (domains.length === 0) return true;
  const domain = email.slice(email.lastIndexOf('@') + 1);
  return domains.includes(domain);
}

/** Problem with a display name, or null if it's fine. */
export function displayNameProblem(name: string): string | null {
  return name.length < 2 ? 'Enter a display name of at least 2 characters.' : null;
}

export async function startSession(db: Db, reply: FastifyReply, userId: number, config: Config): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  await db.query(`insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`, [
    sha256(token),
    userId,
  ]);
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.production,
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export interface UserRow {
  id: number;
  email: string;
  display_name: string;
  role: 'student' | 'instructor';
  /** Null for accounts that sign in with Google or GitHub. */
  password_hash: string | null;
}

export const toUser = (r: UserRow): User => ({ id: r.id, email: r.email, displayName: r.display_name, role: r.role });

export async function loadUser(db: Db, req: FastifyRequest): Promise<User | null> {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const rows = await db.query<UserRow>(
    `select u.* from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(token)],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export function requireUser(req: FastifyRequest, reply: FastifyReply): User | undefined {
  if (!req.user) {
    reply.code(401).send({ error: 'Please sign in.' });
    return undefined;
  }
  return req.user;
}

const credentials = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', minLength: 3, maxLength: 254 },
    password: { type: 'string', minLength: 1, maxLength: 200 },
    displayName: { type: 'string', maxLength: 40 },
  },
} as const;

export function authRoutes(app: FastifyInstance, db: Db, config: Config): void {
  const limit = { rateLimit: { max: config.authPerMinute, timeWindow: '1 minute' } };

  app.post<{ Body: { email: string; password: string; displayName?: string } }>(
    '/api/auth/register',
    { schema: { body: credentials }, config: limit },
    async (req, reply) => {
      if (!config.emailSignup) return reply.code(403).send({ error: 'New accounts sign up with Google or GitHub.' });
      const email = req.body.email.trim().toLowerCase();
      const displayName = (req.body.displayName ?? '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).send({ error: 'Enter a valid email address.' });
      if (!emailAllowed(email, config.allowedEmailDomains)) {
        return reply.code(400).send({ error: `Use your school email (@${config.allowedEmailDomains.join(' or @')}).` });
      }
      if (req.body.password.length < 8) return reply.code(400).send({ error: 'Use a password of at least 8 characters.' });
      const nameProblem = displayNameProblem(displayName);
      if (nameProblem) return reply.code(400).send({ error: nameProblem });
      const existing = await db.query('select 1 from users where email = $1', [email]);
      if (existing.length) return reply.code(409).send({ error: 'An account with that email already exists.' });
      const passwordHash = await hash(req.body.password, ARGON);
      const [row] = await db.query<UserRow>(
        'insert into users (email, display_name, password_hash) values ($1, $2, $3) returning *',
        [email, displayName, passwordHash],
      );
      await startSession(db, reply, row!.id, config);
      return reply.code(201).send({ user: toUser(row!) });
    },
  );

  app.post<{ Body: { email: string; password: string } }>(
    '/api/auth/login',
    { schema: { body: credentials }, config: limit },
    async (req, reply) => {
      const email = req.body.email.trim().toLowerCase();
      const [row] = await db.query<UserRow>('select * from users where email = $1', [email]);
      // Google and GitHub accounts have no password, so a password never matches them.
      const ok = row?.password_hash ? await verify(row.password_hash, req.body.password) : false;
      if (!row || !ok) return reply.code(401).send({ error: 'Wrong email or password.' });
      await db.query('delete from sessions where user_id = $1 and expires_at < now()', [row.id]);
      await startSession(db, reply, row.id, config);
      return { user: toUser(row) };
    },
  );

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await db.query('delete from sessions where token_hash = $1', [sha256(token)]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });
}
