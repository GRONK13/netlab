import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SOLUTIONS } from '../../../packages/labs/test/solutions.ts';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { connect, migrate, type Db } from '../src/db.ts';

let db: Db;
let app: FastifyInstance;

beforeAll(async () => {
  db = await connect();
  await migrate(db);
  app = await buildApp(db, { ...loadConfig({}), allowedEmailDomains: ['school.edu'], webDist: '/nonexistent' });
});

afterAll(async () => {
  await app.close();
  await db.close();
});

async function register(email: string, displayName = 'Student') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'correct horse', displayName },
  });
  const cookie = res.cookies.find((c) => c.name === 'netlab_sid');
  return { res, cookie: cookie ? `netlab_sid=${cookie.value}` : '' };
}

const post = (url: string, cookie: string, payload: unknown = {}) =>
  app.inject({ method: 'POST', url, headers: { cookie }, payload: payload as object });

describe('auth', () => {
  it('only lets school emails register', async () => {
    const bad = await register('someone@gmail.com');
    expect(bad.res.statusCode).toBe(400);
    expect(bad.res.json().error).toContain('@school.edu');
    const ok = await register('Alice@School.edu', 'Alice');
    expect(ok.res.statusCode).toBe(201);
    expect(ok.res.json().user.email).toBe('alice@school.edu');
    expect(ok.cookie).not.toBe('');
  });

  it('rejects duplicate accounts and short passwords', async () => {
    expect((await register('alice@school.edu')).res.statusCode).toBe(409);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'bob@school.edu', password: 'short', displayName: 'Bob' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('logs in, and refuses a wrong password', async () => {
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'alice@school.edu', password: 'nope' },
    });
    expect(wrong.statusCode).toBe(401);
    const right = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'alice@school.edu', password: 'correct horse' },
    });
    expect(right.statusCode).toBe(200);
  });

  it('requires a session for the API', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/me' })).statusCode).toBe(401);
  });

  it('rejects non-JSON and cross-site writes', async () => {
    const form = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'a=1',
    });
    expect(form.statusCode).toBe(415);
    const cross = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { origin: 'https://evil.example' },
      payload: {},
    });
    expect(cross.statusCode).toBe(403);
  });
});

describe('labs and XP', () => {
  let cookie: string;
  beforeAll(async () => {
    cookie = (await register('carol@school.edu', 'Carol')).cookie;
  });

  it('saves and restores an attempt', async () => {
    const log = [{ device: 'SW1', line: 'enable' }];
    const put = await app.inject({ method: 'PUT', url: '/api/labs/switch-basics/attempt', headers: { cookie }, payload: { log } });
    expect(put.statusCode).toBe(204);
    const get = await app.inject({ method: 'GET', url: '/api/labs/switch-basics/attempt', headers: { cookie } });
    expect(get.json()).toEqual({ log, hintsUsed: 0, completed: false });
  });

  it('awards nothing for an incomplete log', async () => {
    const res = await post('/api/labs/switch-basics/submit', cookie, { log: [{ device: 'SW1', line: 'enable' }] });
    expect(res.json()).toMatchObject({ passed: false, xpAwarded: 0 });
    expect(res.json().results).toContain(false);
  });

  it('awards XP once, minus hints', async () => {
    expect((await post('/api/labs/separate-departments/hint', cookie)).json()).toEqual({ hintsUsed: 1 });
    const first = await post('/api/labs/separate-departments/submit', cookie, { log: SOLUTIONS['separate-departments'] });
    expect(first.json()).toMatchObject({ passed: true, xpAwarded: 135, alreadyCompleted: false });
    const again = await post('/api/labs/separate-departments/submit', cookie, { log: SOLUTIONS['separate-departments'] });
    expect(again.json()).toMatchObject({ passed: true, xpAwarded: 0, alreadyCompleted: true });
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    expect(me.json().level).toMatchObject({ xp: 135, level: 2 });
  });

  it('caps hints at three', async () => {
    for (let i = 0; i < 5; i++) await post('/api/labs/router-on-a-stick/hint', cookie);
    const get = await app.inject({ method: 'GET', url: '/api/labs/router-on-a-stick/attempt', headers: { cookie } });
    expect(get.json().hintsUsed).toBe(3);
  });

  it('rejects oversized logs and unknown labs', async () => {
    const huge = Array.from({ length: 5001 }, () => ({ device: 'SW1', line: 'en' }));
    expect((await post('/api/labs/switch-basics/submit', cookie, { log: huge })).statusCode).toBe(400);
    expect((await post('/api/labs/nope/submit', cookie, { log: [] })).statusCode).toBe(404);
  });

  it('ranks students on the leaderboard', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/leaderboard', headers: { cookie } });
    expect(res.json().entries[0]).toMatchObject({ place: 1, displayName: 'Carol', xp: 135, labs: 1, rank: 'Patch Panel Pro' });
  });
});
