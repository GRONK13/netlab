// Sign in with Google or GitHub: OAuth 2.0 authorization code flow, with PKCE where the
// provider supports it. A first sign-in with an unknown identity waits in pending_signups
// until the student chooses the display name others will see.

import { randomBytes } from 'node:crypto';
import * as arctic from 'arctic';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { sha256, startSession, toUser, type UserRow } from './auth.ts';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { displayNameProblem } from './names.ts';

/** Who the provider says signed in. `email` is null unless the provider has verified it. */
export interface Identity {
  subject: string;
  email: string | null;
  name: string;
}

export interface OAuthProvider {
  label: string;
  authorizeUrl(state: string, verifier: string): URL;
  identity(code: string, verifier: string): Promise<Identity>;
}

const STATE_COOKIE = 'netlab_oauth_state';
const VERIFIER_COOKIE = 'netlab_oauth_verifier';
export const SIGNUP_COOKIE = 'netlab_signup';
const COOKIE_PATH = '/api/auth';
const SIGNUP_MINUTES = 15;

function google(app: NonNullable<Config['google']>, redirect: string): OAuthProvider {
  const client = new arctic.Google(app.clientId, app.clientSecret, redirect);
  return {
    label: 'Google',
    authorizeUrl: (state, verifier) => client.createAuthorizationURL(state, verifier, ['openid', 'email', 'profile']),
    async identity(code, verifier) {
      const tokens = await client.validateAuthorizationCode(code, verifier);
      // The ID token came straight from Google's token endpoint over TLS, so its claims can be trusted.
      return googleIdentity(arctic.decodeIdToken(tokens.idToken()) as GoogleClaims);
    },
  };
}

export interface GoogleClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export function googleIdentity(c: GoogleClaims): Identity {
  return {
    subject: c.sub,
    email: c.email && c.email_verified ? c.email.toLowerCase() : null,
    name: c.name ?? '',
  };
}

function github(app: NonNullable<Config['github']>, redirect: string): OAuthProvider {
  const client = new arctic.GitHub(app.clientId, app.clientSecret, redirect);
  const api = async <T>(path: string, token: string): Promise<T> => {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'NetLab' },
    });
    if (!res.ok) throw new Error(`GitHub ${path} returned ${res.status}`);
    return (await res.json()) as T;
  };
  return {
    label: 'GitHub',
    // GitHub's OAuth apps don't take PKCE; the state cookie still ties the callback to this browser.
    authorizeUrl: (state) => client.createAuthorizationURL(state, ['read:user', 'user:email']),
    async identity(code) {
      const token = (await client.validateAuthorizationCode(code)).accessToken();
      const [user, emails] = await Promise.all([
        api<GitHubUser>('/user', token),
        api<GitHubEmail[]>('/user/emails', token),
      ]);
      return githubIdentity(user, emails);
    },
  };
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export function githubIdentity(user: GitHubUser, emails: GitHubEmail[]): Identity {
  const primary = emails.find((e) => e.primary && e.verified);
  return { subject: String(user.id), email: primary ? primary.email.toLowerCase() : null, name: user.name || user.login };
}

/** The providers whose OAuth apps are configured. */
export function providersFrom(config: Config): Record<string, OAuthProvider> {
  const redirect = (id: string) => `${config.publicUrl}/api/auth/${id}/callback`;
  const out: Record<string, OAuthProvider> = {};
  if (config.google) out.google = google(config.google, redirect('google'));
  if (config.github) out.github = github(config.github, redirect('github'));
  return out;
}

/** The suggested display name: the provider's name, or the email's first part. */
function suggestedName(identity: Identity, email: string): string {
  const name = identity.name.trim().slice(0, 40);
  return name.length >= 2 ? name : email.split('@')[0]!.slice(0, 40);
}

export function oauthRoutes(
  app: FastifyInstance,
  db: Db,
  config: Config,
  providers: Record<string, OAuthProvider>,
): void {
  const limit = { rateLimit: { max: config.authPerMinute, timeWindow: '1 minute' } };
  const cookie = (maxAge: number) => ({
    path: COOKIE_PATH,
    httpOnly: true,
    // Lax: the browser sends it on the provider's top-level redirect back to us.
    sameSite: 'lax' as const,
    secure: config.production,
    maxAge,
  });
  const provider = (id: string) => (Object.hasOwn(providers, id) ? providers[id] : undefined);
  const params = {
    type: 'object',
    required: ['provider'],
    properties: { provider: { type: 'string', maxLength: 20 } },
  } as const;
  // Back to the sign-in page with a reason it can explain.
  const failed = (reply: FastifyReply, reason: string) => reply.redirect(`/#/signin?error=${reason}`);

  app.get('/api/auth/providers', async () => ({
    providers: Object.entries(providers).map(([id, p]) => ({ id, label: p.label })),
    emailSignup: config.emailSignup,
  }));

  app.get<{ Params: { provider: string } }>(
    '/api/auth/:provider/start',
    { schema: { params }, config: limit },
    async (req, reply) => {
      const p = provider(req.params.provider);
      if (!p) return reply.code(404).send({ error: 'No such sign-in provider.' });
      const state = arctic.generateState();
      const verifier = arctic.generateCodeVerifier();
      reply.setCookie(STATE_COOKIE, state, cookie(600));
      reply.setCookie(VERIFIER_COOKIE, verifier, cookie(600));
      return reply.redirect(p.authorizeUrl(state, verifier).toString());
    },
  );

  app.get<{ Params: { provider: string }; Querystring: { code?: string; state?: string } }>(
    '/api/auth/:provider/callback',
    {
      schema: {
        params,
        querystring: {
          type: 'object',
          properties: { code: { type: 'string', maxLength: 2048 }, state: { type: 'string', maxLength: 200 } },
        },
      },
      config: limit,
    },
    async (req, reply) => {
      const p = provider(req.params.provider);
      if (!p) return reply.code(404).send({ error: 'No such sign-in provider.' });
      const state = req.cookies[STATE_COOKIE];
      const verifier = req.cookies[VERIFIER_COOKIE];
      reply.clearCookie(STATE_COOKIE, { path: COOKIE_PATH });
      reply.clearCookie(VERIFIER_COOKIE, { path: COOKIE_PATH });
      const { code } = req.query;
      // No code: the student cancelled on the provider's page.
      if (!code) return failed(reply, 'cancelled');
      if (!state || !verifier || req.query.state !== state) return failed(reply, 'expired');

      let who: Identity;
      try {
        who = await p.identity(code, verifier);
      } catch (e) {
        req.log.warn({ err: e, provider: req.params.provider }, 'OAuth sign-in failed');
        return failed(reply, 'failed');
      }
      if (!who.email) return failed(reply, 'no-email');

      const userId = await accountFor(db, req.params.provider, who.subject, who.email);
      if (userId !== null) {
        await startSession(db, reply, userId, config);
        return reply.redirect('/#/');
      }
      const token = randomBytes(32).toString('base64url');
      await db.query(
        `insert into pending_signups (token_hash, provider, subject, email, suggested_name, expires_at)
         values ($1, $2, $3, $4, $5, now() + interval '${SIGNUP_MINUTES} minutes')`,
        [sha256(token), req.params.provider, who.subject, who.email, suggestedName(who, who.email)],
      );
      await db.query('delete from pending_signups where expires_at < now()');
      reply.setCookie(SIGNUP_COOKIE, token, cookie(SIGNUP_MINUTES * 60));
      return reply.redirect('/#/welcome');
    },
  );

  const pending = async (req: FastifyRequest) => {
    const token = req.cookies[SIGNUP_COOKIE];
    if (!token) return undefined;
    const [row] = await db.query<PendingRow>(
      'select * from pending_signups where token_hash = $1 and expires_at > now()',
      [sha256(token)],
    );
    return row;
  };
  const expired = { error: 'Your sign-in expired. Start again from the sign-in page.' };

  app.get('/api/auth/pending', async (req, reply) => {
    const row = await pending(req);
    if (!row) return reply.code(404).send(expired);
    return {
      email: row.email,
      suggestedName: row.suggested_name,
      provider: provider(row.provider)?.label ?? row.provider,
    };
  });

  app.post<{ Body: { displayName: string } }>(
    '/api/auth/complete',
    {
      schema: {
        body: {
          type: 'object',
          required: ['displayName'],
          additionalProperties: false,
          properties: { displayName: { type: 'string', maxLength: 40 } },
        },
      },
      config: limit,
    },
    async (req, reply) => {
      const displayName = req.body.displayName.trim();
      const problem = displayNameProblem(displayName);
      if (problem) return reply.code(400).send({ error: problem });
      const token = req.cookies[SIGNUP_COOKIE];
      // Deleting it is the claim: a second request with the same cookie finds nothing.
      const [row] = token
        ? await db.query<PendingRow>(
            'delete from pending_signups where token_hash = $1 and expires_at > now() returning *',
            [sha256(token)],
          )
        : [];
      if (!row) return reply.code(404).send(expired);
      reply.clearCookie(SIGNUP_COOKIE, { path: COOKIE_PATH });

      // Someone may have signed up with this identity or email in the meantime.
      let userId = await accountFor(db, row.provider, row.subject, row.email);
      if (userId === null) {
        const [created] = await db.query<{ id: number }>(
          `insert into users (email, display_name, password_hash) values ($1, $2, null)
           on conflict (email) do nothing returning id`,
          [row.email, displayName],
        );
        userId = created?.id ?? (await accountFor(db, row.provider, row.subject, row.email))!;
        await link(db, row.provider, row.subject, userId);
      }
      await startSession(db, reply, userId, config);
      const [user] = await db.query<UserRow>('select * from users where id = $1', [userId]);
      return reply.code(201).send({ user: toUser(user!) });
    },
  );
}

interface PendingRow {
  provider: string;
  subject: string;
  email: string;
  suggested_name: string;
}

async function link(db: Db, provider: string, subject: string, userId: number): Promise<void> {
  await db.query(
    'insert into oauth_accounts (provider, subject, user_id) values ($1, $2, $3) on conflict do nothing',
    [provider, subject, userId],
  );
}

/**
 * The account this identity signs into: one already linked to it, or an existing account
 * with the same (verified) email, which gets linked now. Null for someone new.
 *
 * NetLab never verified the emails of password accounts; the provider just has. Whoever
 * set that password may not own the address, so linking ends the password and every
 * session, and from then on only the verified provider signs in.
 */
async function accountFor(db: Db, provider: string, subject: string, email: string): Promise<number | null> {
  const [linked] = await db.query<{ user_id: number }>(
    'select user_id from oauth_accounts where provider = $1 and subject = $2',
    [provider, subject],
  );
  if (linked) return linked.user_id;
  const [same] = await db.query<{ id: number }>('select id from users where email = $1', [email]);
  if (!same) return null;
  await link(db, provider, subject, same.id);
  await db.query('update users set password_hash = null where id = $1', [same.id]);
  await db.query('delete from sessions where user_id = $1', [same.id]);
  return same.id;
}
