import { solve, type Problem } from '@netlab/modules';
import { Network } from '@netlab/sim';
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

  it('saves and loads a sandbox, rejecting broken ones', async () => {
    const empty = await app.inject({ method: 'GET', url: '/api/sandbox', headers: { cookie } });
    expect(empty.json()).toEqual({ snapshot: null });
    const net = new Network({ devices: [], links: [] });
    net.addDevice('switch', 50, 40);
    net.addDevice('pc', 20, 80);
    net.connect({ device: 'Switch0', port: 'FastEthernet0/1' }, { device: 'PC0', port: 'FastEthernet0' });
    const put = await app.inject({ method: 'PUT', url: '/api/sandbox', headers: { cookie }, payload: { snapshot: net.snapshot() } });
    expect(put.statusCode).toBe(204);
    const got = await app.inject({ method: 'GET', url: '/api/sandbox', headers: { cookie } });
    expect(got.json().snapshot.topology.links).toHaveLength(1);
    const bad = net.snapshot();
    bad.topology.devices[0]!.kind = 'toaster' as never;
    const rejected = await app.inject({ method: 'PUT', url: '/api/sandbox', headers: { cookie }, payload: { snapshot: bad } });
    expect(rejected.statusCode).toBe(400);
  });

  it('ranks students on the leaderboard', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/leaderboard', headers: { cookie } });
    expect(res.json().entries[0]).toMatchObject({ place: 1, displayName: 'Carol', xp: 135, labs: 1, rank: 'Patch Panel Pro' });
  });
});

describe('subnetting trainer', () => {
  let cookie: string;
  beforeAll(async () => {
    cookie = (await register('dave@school.edu', 'Dave')).cookie;
  });

  const start = async (who = cookie) => {
    const res = await post('/api/trainer/subnetting/start', who);
    expect(res.statusCode).toBe(200);
    return res.json() as { roundId: number; problems: Problem[] };
  };
  const finish = (roundId: number, answers: string[], who = cookie) =>
    post(`/api/trainer/rounds/${roundId}/finish`, who, { answers });

  it('describes the trainer, and 404s unknown kinds', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/trainer/subnetting',
      headers: { cookie },
    });
    expect(res.json()).toMatchObject({
      spec: { problems: 10, target: 8, xp: 50 },
      best: null,
      earned: false,
    });
    for (const kind of ['nope', '__proto__', 'constructor']) {
      expect(
        (await app.inject({ method: 'GET', url: `/api/trainer/${kind}`, headers: { cookie } }))
          .statusCode,
      ).toBe(404);
      expect((await post(`/api/trainer/${kind}/start`, cookie)).statusCode).toBe(404);
    }
  });

  it('sends problems without answers', async () => {
    const round = await start();
    expect(round.problems).toHaveLength(10);
    expect(JSON.stringify(round)).not.toContain('"answers"');
    await finish(round.roundId, []);
  });

  it('grades on the server and awards XP once', async () => {
    const first = await start();
    const res = await finish(first.roundId, first.problems.map(solve));
    expect(res.json()).toMatchObject({ correct: 10, total: 10, qualified: true, xpAwarded: 50 });
    expect(res.json().level.xp).toBe(50);
    expect((await finish(first.roundId, first.problems.map(solve))).statusCode).toBe(409);

    const second = await start();
    const again = await finish(second.roundId, second.problems.map(solve));
    expect(again.json()).toMatchObject({ qualified: true, xpAwarded: 0, best: { correct: 10 } });
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    expect(me.json().level.xp).toBe(50);
    expect(me.json().moduleSteps).toMatchObject([
      { moduleId: 'ip-addressing', step: 'trainer', xpAwarded: 50 },
    ]);
  });

  it('needs 8 correct within the time limit, measured by the server', async () => {
    const erin = (await register('erin@school.edu', 'Erin')).cookie;
    const short = await start(erin);
    const answers = short.problems.map(solve);
    answers[0] = answers[1] = answers[2] = 'wrong';
    expect((await finish(short.roundId, answers, erin)).json()).toMatchObject({
      correct: 7,
      qualified: false,
      xpAwarded: 0,
    });

    const slow = await start(erin);
    await db.query(
      `update trainer_rounds set started_at = now() - interval '6 minutes' where id = $1`,
      [slow.roundId],
    );
    const late = await finish(slow.roundId, slow.problems.map(solve), erin);
    expect(late.json()).toMatchObject({ correct: 10, qualified: false, xpAwarded: 0 });
    expect(late.json().durationMs).toBeGreaterThan(5 * 60_000);
  });

  it("refuses someone else's round and malformed answers", async () => {
    const round = await start();
    const frank = (await register('frank@school.edu', 'Frank')).cookie;
    expect((await finish(round.roundId, [], frank)).statusCode).toBe(404);
    expect((await finish(round.roundId, ['x'.repeat(41)])).statusCode).toBe(400);
    expect((await post('/api/trainer/rounds/abc/finish', cookie, { answers: [] })).statusCode).toBe(
      400,
    );
  });

  it('counts trainer XP on the leaderboard but not as a lab', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/leaderboard', headers: { cookie } });
    expect(res.json().entries).toContainEqual(
      expect.objectContaining({ displayName: 'Dave', xp: 50, labs: 0 }),
    );
    expect(res.json().entries.map((e: { displayName: string }) => e.displayName)).not.toContain(
      'Frank',
    );
  });
});
