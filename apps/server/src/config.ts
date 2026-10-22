import { fileURLToPath } from 'node:url';

export interface OAuthApp {
  clientId: string;
  clientSecret: string;
}

export interface Config {
  port: number;
  host: string;
  production: boolean;
  /** Postgres connection string. When unset, an embedded PGlite database is used. */
  databaseUrl?: string;
  /** Where PGlite keeps its files when DATABASE_URL is unset. */
  pgliteDir: string;
  /** Lowercase email domains allowed to register, e.g. ["usc.edu.ph"]. Empty = any. */
  allowedEmailDomains: string[];
  /** Sign-in and registration attempts allowed per minute from one address. */
  authPerMinute: number;
  /** Where the site is served, for OAuth redirect URLs, e.g. "https://netlab.dcism.org". */
  publicUrl: string;
  /** OAuth apps; a provider is offered only when both its id and secret are set. */
  google?: OAuthApp;
  github?: OAuthApp;
  /** New accounts may register with email and password. */
  emailSignup: boolean;
  /** The school whose students the leaderboard can filter to: its short name and email domain. */
  schoolName: string;
  schoolDomain: string;
  /** Built web app to serve, if present. */
  webDist: string;
}

const root = fileURLToPath(new URL('../../../', import.meta.url));

const oauthApp = (id?: string, secret?: string): OAuthApp | undefined =>
  id && secret ? { clientId: id, clientSecret: secret } : undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT ?? 3001);
  // In production, providers need PUBLIC_URL: their redirect address must be the real site.
  const canRedirect = !production || !!env.PUBLIC_URL;
  const google = canRedirect ? oauthApp(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET) : undefined;
  const github = canRedirect ? oauthApp(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET) : undefined;
  return {
    port,
    host: env.HOST ?? '127.0.0.1',
    production,
    databaseUrl: env.DATABASE_URL || undefined,
    pgliteDir: env.PGLITE_DIR ?? `${root}.data/pglite`,
    allowedEmailDomains: (env.ALLOWED_EMAIL_DOMAIN ?? '')
      .split(',')
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean),
    authPerMinute: Number(env.AUTH_RATE_LIMIT ?? 10),
    publicUrl: (env.PUBLIC_URL ?? `http://localhost:${production ? port : 5173}`).replace(/\/$/, ''),
    google,
    github,
    // Email sign-up stays open until a provider can take over: there's no way to verify
    // emails or reset passwords without a mail server. EMAIL_SIGNUP=1 or 0 overrides.
    emailSignup: env.EMAIL_SIGNUP ? env.EMAIL_SIGNUP === '1' : !production || (!google && !github),
    schoolName: env.SCHOOL_NAME ?? 'USC',
    schoolDomain: (env.SCHOOL_DOMAIN ?? 'usc.edu.ph').toLowerCase(),
    webDist: `${root}apps/web/dist`,
  };
}
