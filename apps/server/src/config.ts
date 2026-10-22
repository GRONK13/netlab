import { fileURLToPath } from 'node:url';

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
  /** Built web app to serve, if present. */
  webDist: string;
}

const root = fileURLToPath(new URL('../../../', import.meta.url));

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 3001),
    host: env.HOST ?? '127.0.0.1',
    production: env.NODE_ENV === 'production',
    databaseUrl: env.DATABASE_URL || undefined,
    pgliteDir: env.PGLITE_DIR ?? `${root}.data/pglite`,
    allowedEmailDomains: (env.ALLOWED_EMAIL_DOMAIN ?? '')
      .split(',')
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean),
    authPerMinute: Number(env.AUTH_RATE_LIMIT ?? 10),
    webDist: `${root}apps/web/dist`,
  };
}
