import { dayNumber, fromDayNumber, solve, type Problem, type Question } from '@netlab/modules';
import { ANSWERS, answerText } from '@netlab/modules/answers';
import { Network } from '@netlab/sim';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SOLUTIONS } from '../../../packages/labs/test/solutions.ts';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { connect, manilaDay, migrate, type Db } from '../src/db.ts';
import { findUsers, renameUser, setHidden } from '../src/admin.ts';
import { backfillBadges } from '../src/progress.ts';
import { githubIdentity, googleIdentity, type Identity, type OAuthProvider } from '../src/oauth.ts';

let db: Db;
let app: FastifyInstance;

beforeAll(async () => {
  db = await connect();
  await migrate(db);
  app = await buildApp(db, {
    ...loadConfig({}),
    allowedEmailDomains: ['school.edu'],
    schoolDomain: 'school.edu',
    webDist: '/nonexistent',
  });
});

afterAll(async () => {
  await app.close();
  await db.close();
});

// Registration allows 10 a minute per address, so later suites register from another one.
async function register(email: string, displayName = 'Student', remoteAddress = '127.0.0.1') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    remoteAddress,
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

describe('learning modules', () => {
  let cookie: string;
  beforeAll(async () => {
    cookie = (await register('gina@school.edu', 'Gina')).cookie;
  });

  const keys = ANSWERS['ip-addressing']!;
  const right = (q: Question) => (q.kind === 'choice' ? String(keys[q.id]!.answer) : answerText(q, keys[q.id]!));
  const startQuiz = async (who = cookie) => {
    const res = await post('/api/modules/ip-addressing/quiz', who);
    expect(res.statusCode).toBe(200);
    return res.json() as { attemptId: number; questions: Question[]; pass: number };
  };
  const submit = (attemptId: number, answers: string[], who = cookie) =>
    post(`/api/quiz/${attemptId}/submit`, who, { answers });

  it('records a lesson as read, once, for 0 XP', async () => {
    expect((await post('/api/modules/ip-addressing/lesson', cookie)).json()).toEqual({ newBadges: [] });
    expect((await post('/api/modules/ip-addressing/lesson', cookie)).statusCode).toBe(200);
    const me = (await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).json();
    expect(me.moduleSteps).toMatchObject([{ moduleId: 'ip-addressing', step: 'lesson', xpAwarded: 0 }]);
    expect(me.level.xp).toBe(0);
    expect((await post('/api/modules/nope/lesson', cookie)).statusCode).toBe(404);
    expect((await post('/api/modules/__proto__/quiz', cookie)).statusCode).toBe(404);
  });

  it('draws 10 different questions without answers', async () => {
    const quiz = await startQuiz();
    expect(quiz.questions).toHaveLength(10);
    expect(new Set(quiz.questions.map((q) => q.id)).size).toBe(10);
    for (const q of quiz.questions) expect(q).not.toHaveProperty('answer');
    expect(JSON.stringify(quiz)).not.toContain('explanation');
  });

  it("flags wrong answers on a fail without revealing the right ones", async () => {
    const quiz = await startQuiz();
    const answers = quiz.questions.map((q, i) => (i < 5 ? right(q) : 'wrong'));
    const res = await submit(quiz.attemptId, answers);
    expect(res.json()).toMatchObject({ correct: 5, total: 10, passed: false, xpAwarded: 0, review: null });
    expect(res.json().results).toEqual([true, true, true, true, true, false, false, false, false, false]);
    const body = JSON.stringify(res.json());
    expect(body).not.toContain('explanation');
    expect(body).not.toContain('"answer"');
  });

  it('awards quiz XP on the first pass only, with explanations', async () => {
    const quiz = await startQuiz();
    const answers = quiz.questions.map((q, i) => (i < 8 ? right(q) : ''));
    const res = await submit(quiz.attemptId, answers);
    expect(res.json()).toMatchObject({ correct: 8, passed: true, xpAwarded: 75 });
    expect(res.json().review).toHaveLength(10);
    expect(res.json().review[0].explanation.length).toBeGreaterThan(10);
    expect(res.json().level.xp).toBe(75);

    expect((await submit(quiz.attemptId, answers)).statusCode).toBe(409);
    const again = await startQuiz();
    const second = await submit(again.attemptId, again.questions.map(right));
    expect(second.json()).toMatchObject({ correct: 10, passed: true, xpAwarded: 0 });
  });

  it("refuses someone else's, expired and malformed attempts", async () => {
    const quiz = await startQuiz();
    const hal = (await register('hal@school.edu', 'Hal')).cookie;
    expect((await submit(quiz.attemptId, [], hal)).statusCode).toBe(404);
    expect((await submit(quiz.attemptId, ['x'.repeat(101)])).statusCode).toBe(400);
    expect((await submit(quiz.attemptId, Array.from({ length: 21 }, () => '1'))).statusCode).toBe(400);
    await db.query(`update quiz_attempts set started_at = now() - interval '3 hours' where id = $1`, [quiz.attemptId]);
    expect((await submit(quiz.attemptId, [])).statusCode).toBe(410);
    expect((await submit(999999, [])).statusCode).toBe(404);
  });
});

describe('streaks and the weekly goal', () => {
  let cookie: string;
  let id: number;
  beforeAll(async () => {
    const r = await register('ivy@school.edu', 'Ivy', '10.0.0.2');
    cookie = r.cookie;
    id = r.res.json().user.id;
  });

  const me = async () => (await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).json();
  const setGoal = (payload: unknown, who = cookie) =>
    app.inject({ method: 'PUT', url: '/api/me/goal', headers: { cookie: who }, payload: payload as object });
  const rows = async (table: 'practice_days' | 'goal_weeks', column: 'day' | 'week') =>
    (await db.query<{ d: string }>(`select ${column}::text as d from ${table} where user_id = $1 order by 1`, [id])).map(
      (r) => r.d,
    );

  it('reads Manila days off the database clock', async () => {
    const day = async (ts: string) =>
      (await db.query<{ d: string }>(`select ${manilaDay(`timestamptz '${ts}'`)}::text as d`))[0]!.d;
    expect(await day('2026-10-20T15:59:59Z')).toBe('2026-10-20');
    expect(await day('2026-10-20T16:30:00Z')).toBe('2026-10-21');
  });

  it('starts at zero with a goal of 3 days', async () => {
    const { progress } = await me();
    expect(progress.streak).toEqual({ current: 0, longest: 0, practicedToday: false, freeMissUsed: false });
    expect(progress.week).toMatchObject({ goal: 3, count: 0, met: false });
    expect(progress.week.days).toEqual([false, false, false, false, false, false, false]);
  });

  it('counts only real work as practice', async () => {
    await post('/api/labs/switch-basics/submit', cookie, { log: [] });
    const round = (await post('/api/trainer/subnetting/start', cookie)).json();
    await post(`/api/trainer/rounds/${round.roundId}/finish`, cookie, { answers: [] });
    expect(await rows('practice_days', 'day')).toEqual([]);

    await post('/api/labs/switch-basics/submit', cookie, { log: [{ device: 'SW1', line: 'enable' }] });
    const { progress } = await me();
    expect(await rows('practice_days', 'day')).toEqual([progress.today]);
    expect(progress.streak).toMatchObject({ current: 1, longest: 1, practicedToday: true });
    expect(progress.week.count).toBe(1);
  });

  it('counts a lesson the first time it is read', async () => {
    await db.query('delete from practice_days where user_id = $1', [id]);
    await post('/api/modules/switching-vlans/lesson', cookie);
    expect(await rows('practice_days', 'day')).toHaveLength(1);
    await db.query('delete from practice_days where user_id = $1', [id]);
    await post('/api/modules/switching-vlans/lesson', cookie);
    expect(await rows('practice_days', 'day')).toEqual([]);
  });

  it('validates the goal and needs a session', async () => {
    for (const days of [1, 6, 2.5, null]) expect((await setGoal({ days })).statusCode).toBe(400);
    expect((await setGoal({})).statusCode).toBe(400);
    expect((await setGoal({ days: 4 }, '')).statusCode).toBe(401);
    expect((await me()).progress.week.goal).toBe(3);
  });

  it('records the week once the goal is reached', async () => {
    await post('/api/labs/switch-basics/submit', cookie, { log: [{ device: 'SW1', line: 'enable' }] });
    const { today, week } = (await me()).progress;
    const res = await setGoal({ days: 2 });
    expect(res.json().week).toMatchObject({ start: week.start, goal: 2, count: 1, met: false });
    expect(await rows('goal_weeks', 'week')).toEqual([]);

    // Another day this week, written directly because the test can't move the clock.
    const other = week.start === today ? fromDayNumber(dayNumber(today) + 1) : week.start;
    await db.query('insert into practice_days (user_id, day) values ($1, $2)', [id, other]);
    await setGoal({ days: 3 });
    await setGoal({ days: 2 });
    expect(await rows('goal_weeks', 'week')).toEqual([]);
    // Today's first practice reaches the goal.
    await db.query('delete from practice_days where user_id = $1 and day = $2', [id, today]);
    await post('/api/labs/switch-basics/submit', cookie, { log: [{ device: 'SW1', line: 'enable' }] });
    expect(await rows('goal_weeks', 'week')).toEqual([week.start]);
    expect((await me()).progress.week).toMatchObject({ goal: 2, count: 2, met: true });

    // Changing the goal doesn't record or undo a week on its own.
    expect((await setGoal({ days: 5 })).json().week).toMatchObject({ goal: 5, met: false });
    expect(await rows('goal_weeks', 'week')).toEqual([week.start]);
  });

  it('shows streaks on the leaderboard, without user ids', async () => {
    const board = (await app.inject({ method: 'GET', url: '/api/leaderboard', headers: { cookie } })).json();
    expect(board.entries.find((e: { displayName: string }) => e.displayName === 'Dave')).toMatchObject({ streak: 1 });
    for (const e of board.entries) expect(Object.keys(e)).not.toContain('id');
  });

  it('backfills practice days from work done before streaks existed', async () => {
    const old = await connect();
    await migrate(old);
    // Roll migration 5 back, add earlier work, and run it again.
    await old.exec(`drop table practice_days; drop table goal_weeks; alter table users drop column weekly_goal;
      delete from schema_migrations where version = 5;`);
    const [u] = await old.query<{ id: number }>(
      `insert into users (email, display_name, password_hash) values ('old@school.edu', 'Old', 'x') returning id`,
    );
    await old.query(
      `insert into completions (user_id, lab_id, xp_awarded, hints_used, completed_at)
       values ($1, 'switch-basics', 100, 0, '2026-10-01T17:00:00Z')`,
      [u!.id],
    );
    await old.query(
      `insert into trainer_rounds (user_id, kind, seed, started_at, finished_at, correct) values
       ($1, 'subnetting', 1, '2026-10-03T01:00:00Z', '2026-10-03T01:04:00Z', 6),
       ($1, 'subnetting', 2, '2026-10-04T01:00:00Z', '2026-10-04T01:04:00Z', 0),
       ($1, 'subnetting', 3, '2026-10-05T01:00:00Z', null, null)`,
      [u!.id],
    );
    expect(await migrate(old)).toBe(1);
    const days = await old.query<{ d: string }>('select day::text as d from practice_days order by 1');
    expect(days.map((r) => r.d)).toEqual(['2026-10-02', '2026-10-03']);
    const [goal] = await old.query<{ weekly_goal: number }>('select weekly_goal from users');
    expect(goal!.weekly_goal).toBe(3);
    await old.close();
  });
});

describe('badges', () => {
  let cookie: string;
  let id: number;
  beforeAll(async () => {
    const r = await register('jo@school.edu', 'Jo', '10.0.0.3');
    cookie = r.cookie;
    id = r.res.json().user.id;
  });

  const me = async () => (await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).json();

  it('awards badges once, in the response that earns them', async () => {
    const log = SOLUTIONS['switch-basics'];
    const first = await post('/api/labs/switch-basics/submit', cookie, { log });
    expect(first.json()).toMatchObject({ passed: true, newBadges: ['first-link', 'no-hints'] });
    const again = await post('/api/labs/switch-basics/submit', cookie, { log });
    expect(again.json().newBadges).toEqual([]);

    const { progress } = await me();
    expect(progress.badges.map((b: { id: string }) => b.id)).toEqual(['first-link', 'no-hints']);
    expect(new Date(progress.badges[0].earnedAt).getTime()).toBeGreaterThan(0);
  });

  it('awards quiz and trainer badges from their results', async () => {
    const keys = ANSWERS['ip-addressing']!;
    const right = (q: Question) => (q.kind === 'choice' ? String(keys[q.id]!.answer) : answerText(q, keys[q.id]!));
    const quiz = (await post('/api/modules/ip-addressing/quiz', cookie)).json();
    const res = await post(`/api/quiz/${quiz.attemptId}/submit`, cookie, { answers: quiz.questions.map(right) });
    expect(res.json()).toMatchObject({ correct: 10, newBadges: ['ten-for-ten'] });

    const round = (await post('/api/trainer/subnetting/start', cookie)).json();
    const done = await post(`/api/trainer/rounds/${round.roundId}/finish`, cookie, {
      answers: round.problems.map(solve),
    });
    expect(done.json()).toMatchObject({ correct: 10, newBadges: ['subnet-sprinter'] });
  });

  it('backfills badges earned before they existed; /api/me only reads them', async () => {
    await backfillBadges(db); // Earlier suites' students, so the count below is only Jo's.
    await db.query('delete from badges where user_id = $1', [id]);
    expect((await me()).progress.badges).toEqual([]);
    expect(await backfillBadges(db)).toBe(4);
    const { progress } = await me();
    expect(progress.badges.map((b: { id: string }) => b.id).sort()).toEqual(
      ['first-link', 'no-hints', 'subnet-sprinter', 'ten-for-ten'],
    );
    expect(await backfillBadges(db)).toBe(0);
  });

  it('counts badges on the leaderboard', async () => {
    const board = (await app.inject({ method: 'GET', url: '/api/leaderboard', headers: { cookie } })).json();
    expect(board.entries.find((e: { displayName: string }) => e.displayName === 'Jo')).toMatchObject({
      badges: 4,
      streak: 1,
    });
  });
});

describe('sign in with Google or GitHub', () => {
  let oapp: FastifyInstance;
  // What the fake provider says signed in, by authorization code.
  const identities = new Map<string, Identity>();
  const fake: OAuthProvider = {
    label: 'Fake',
    authorizeUrl: (state) => new URL(`https://provider.example/authorize?state=${state}`),
    identity: async (code) => {
      const who = identities.get(code);
      if (!who) throw new Error('bad code');
      return who;
    },
  };
  const remoteAddress = '10.0.0.4';

  beforeAll(async () => {
    const config = { ...loadConfig({}), emailSignup: false, authPerMinute: 100, webDist: '/nonexistent' };
    oapp = await buildApp(db, config, { providers: { fake } });
  });
  afterAll(() => oapp.close());

  type Res = { cookies: { name: string; value: string }[] };
  const cookieHeader = (res: Res, only?: string) =>
    res.cookies
      .filter((c) => !only || c.name === only)
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  const session = (res: Res) => {
    const c = res.cookies.find((x) => x.name === 'netlab_sid' && x.value);
    return c ? `netlab_sid=${c.value}` : '';
  };
  const meWith = (cookie: string) => oapp.inject({ method: 'GET', url: '/api/me', headers: { cookie } });

  /** Starts a sign-in, then comes back from the provider with `code`. */
  async function signIn(code: string, state?: string) {
    const start = await oapp.inject({ method: 'GET', url: '/api/auth/fake/start', remoteAddress });
    expect(start.statusCode).toBe(302);
    const real = new URL(start.headers.location as string).searchParams.get('state')!;
    return oapp.inject({
      method: 'GET',
      url: `/api/auth/fake/callback?code=${code}&state=${state ?? real}`,
      headers: { cookie: cookieHeader(start) },
      remoteAddress,
    });
  }

  it('lists only the configured providers, and says email sign-up is closed', async () => {
    const res = await oapp.inject({ method: 'GET', url: '/api/auth/providers' });
    expect(res.json()).toEqual({ providers: [{ id: 'fake', label: 'Fake' }], emailSignup: false });
    expect((await oapp.inject({ method: 'GET', url: '/api/auth/nope/start', remoteAddress })).statusCode).toBe(404);
  });

  it('sends the browser to the provider with the state and verifier in short-lived cookies', async () => {
    const start = await oapp.inject({ method: 'GET', url: '/api/auth/fake/start', remoteAddress });
    expect(start.headers.location).toMatch(/^https:\/\/provider\.example\/authorize\?state=/);
    expect(start.cookies.map((c) => c.name).sort()).toEqual(['netlab_oauth_state', 'netlab_oauth_verifier']);
    for (const c of start.cookies) {
      expect(c).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/api/auth', maxAge: 600 });
    }
  });

  it("refuses a callback whose state doesn't match, or that was cancelled or failed", async () => {
    identities.set('mallory', { subject: 'm1', email: 'mallory@example.com', name: 'Mallory' });
    const forged = await signIn('mallory', 'forged');
    expect(forged.statusCode).toBe(302);
    expect(forged.headers.location).toBe('/#/signin?error=expired');
    expect(session(forged)).toBe('');
    const noCookies = await oapp.inject({
      method: 'GET',
      url: '/api/auth/fake/callback?code=mallory&state=x',
      remoteAddress,
    });
    expect(noCookies.headers.location).toBe('/#/signin?error=expired');
    const cancelled = await oapp.inject({
      method: 'GET',
      url: '/api/auth/fake/callback?error=access_denied&state=x',
      remoteAddress,
    });
    expect(cancelled.headers.location).toBe('/#/signin?error=cancelled');
    expect((await signIn('unknown-code')).headers.location).toBe('/#/signin?error=failed');
  });

  it('refuses an identity without a verified email', async () => {
    identities.set('noemail', { subject: 'n1', email: null, name: 'No Email' });
    const res = await signIn('noemail');
    expect(res.headers.location).toBe('/#/signin?error=no-email');
    expect(session(res)).toBe('');
  });

  it('asks a new person for a display name, then creates the account once', async () => {
    identities.set('newbie', { subject: 'g-42', email: 'newbie@gmail.com', name: 'Nora Newbie' });
    const res = await signIn('newbie');
    expect(res.headers.location).toBe('/#/welcome');
    expect(session(res)).toBe('');
    const signup = cookieHeader(res, 'netlab_signup');

    const pending = await oapp.inject({ method: 'GET', url: '/api/auth/pending', headers: { cookie: signup } });
    expect(pending.json()).toEqual({ email: 'newbie@gmail.com', suggestedName: 'Nora Newbie', provider: 'Fake' });

    const complete = (displayName: string) =>
      oapp.inject({
        method: 'POST',
        url: '/api/auth/complete',
        headers: { cookie: signup },
        payload: { displayName },
        remoteAddress,
      });
    expect((await complete('N')).statusCode).toBe(400);
    const done = await complete('Nora');
    expect(done.statusCode).toBe(201);
    expect(done.json().user).toMatchObject({ email: 'newbie@gmail.com', displayName: 'Nora' });
    expect((await meWith(session(done))).json().user.displayName).toBe('Nora');
    // The pending sign-up is used up.
    expect((await complete('Nora again')).statusCode).toBe(404);

    // Next time, the same identity signs straight in.
    const again = await signIn('newbie');
    expect(again.headers.location).toBe('/#/');
    expect((await meWith(session(again))).json().user.email).toBe('newbie@gmail.com');
  });

  const passwordLogin = (email: string) =>
    oapp.inject({ method: 'POST', url: '/api/auth/login', remoteAddress, payload: { email, password: 'correct horse' } });

  it('links a verified email to the existing account, keeping its XP but ending its password', async () => {
    const before = session(await passwordLogin('carol@school.edu'));
    expect((await meWith(before)).statusCode).toBe(200);

    identities.set('carol', { subject: 'gh-7', email: 'carol@school.edu', name: 'Carol C' });
    const res = await signIn('carol');
    expect(res.headers.location).toBe('/#/');
    const me = (await meWith(session(res))).json();
    expect(me.user.displayName).toBe('Carol');
    expect(me.level.xp).toBe(135);

    // Whoever set the unverified password can't get back in, by password or old session.
    expect((await passwordLogin('carol@school.edu')).statusCode).toBe(401);
    expect((await meWith(before)).statusCode).toBe(401);
  });

  it('expires a pending sign-up after 15 minutes', async () => {
    identities.set('slow', { subject: 's-1', email: 'slow@gmail.com', name: 'Slow' });
    const signup = cookieHeader(await signIn('slow'), 'netlab_signup');
    await db.query(`update pending_signups set expires_at = now() - interval '1 minute' where email = 'slow@gmail.com'`);
    const res = await oapp.inject({ method: 'GET', url: '/api/auth/pending', headers: { cookie: signup } });
    expect(res.statusCode).toBe(404);
  });

  it('closes email sign-up, while existing email accounts still sign in', async () => {
    const reg = await oapp.inject({
      method: 'POST',
      url: '/api/auth/register',
      remoteAddress,
      payload: { email: 'late@school.edu', password: 'correct horse', displayName: 'Late' },
    });
    expect(reg.statusCode).toBe(403);
    expect((await passwordLogin('dave@school.edu')).statusCode).toBe(200);
    // A Google or GitHub account has no password to match.
    expect((await passwordLogin('newbie@gmail.com')).statusCode).toBe(401);
  });
});

describe('provider identities', () => {
  it('takes only a verified Google email', () => {
    expect(googleIdentity({ sub: '1', email: 'A@Gmail.com', email_verified: true, name: 'A' })).toEqual({
      subject: '1',
      email: 'a@gmail.com',
      name: 'A',
    });
    expect(googleIdentity({ sub: '1', email: 'a@gmail.com', email_verified: false }).email).toBeNull();
  });

  it("uses GitHub's primary verified email, and the login when there's no name", () => {
    const emails = [
      { email: 'old@x.com', primary: false, verified: true },
      { email: 'Main@X.com', primary: true, verified: true },
    ];
    expect(githubIdentity({ id: 9, login: 'octo', name: null }, emails)).toEqual({
      subject: '9',
      email: 'main@x.com',
      name: 'octo',
    });
    const unverified = [{ email: 'm@x.com', primary: true, verified: false }];
    expect(githubIdentity({ id: 9, login: 'octo', name: 'Oct' }, unverified).email).toBeNull();
  });

  it('keeps email sign-up open until a provider is configured, unless told otherwise', () => {
    expect(loadConfig({}).emailSignup).toBe(true);
    expect(loadConfig({ NODE_ENV: 'production' }).emailSignup).toBe(true);
    const keys = { NODE_ENV: 'production', GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' };
    // Without PUBLIC_URL, production can't build a redirect address, so Google stays off.
    expect(loadConfig(keys).google).toBeUndefined();
    expect(loadConfig(keys).emailSignup).toBe(true);
    const ready = { ...keys, PUBLIC_URL: 'https://netlab.example/' };
    expect(loadConfig(ready).publicUrl).toBe('https://netlab.example');
    expect(loadConfig(ready).emailSignup).toBe(false);
    expect(loadConfig({ ...ready, EMAIL_SIGNUP: '1' }).emailSignup).toBe(true);
    expect(loadConfig({ GITHUB_CLIENT_ID: 'id' }).github).toBeUndefined();
  });
});

describe('accounts and moderation', () => {
  let cookie: string;
  let id: number;
  beforeAll(async () => {
    const r = await register('kim@school.edu', 'Kim', '10.0.0.5');
    cookie = r.cookie;
    id = r.res.json().user.id;
    await post('/api/labs/switch-basics/submit', cookie, { log: SOLUTIONS['switch-basics'] });
  });

  const board = async (scope?: string, who = cookie) =>
    (await app.inject({ method: 'GET', url: `/api/leaderboard${scope ? `?scope=${scope}` : ''}`, headers: { cookie: who } })).json();
  const names = (b: { entries: { displayName: string }[] }) => b.entries.map((e) => e.displayName);
  const put = (url: string, payload: unknown, who = cookie) =>
    app.inject({ method: 'PUT', url, headers: { cookie: who }, payload: payload as object });

  it('renames, checking the name like sign-up does', async () => {
    expect((await put('/api/me/name', { displayName: 'K' })).statusCode).toBe(400);
    expect((await put('/api/me/name', { displayName: 'x'.repeat(41) })).statusCode).toBe(400);
    const res = await put('/api/me/name', { displayName: '  Kim Lee  ' });
    expect(res.json().user.displayName).toBe('Kim Lee');
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).json().user.displayName).toBe('Kim Lee');
    expect(names(await board())).toContain('Kim Lee');
    expect((await put('/api/me/name', { displayName: 'Kim' }, '')).statusCode).toBe(401);
  });

  it('marks your own row, and never sends emails', async () => {
    const b = await board();
    expect(b.entries.filter((e: { you: boolean }) => e.you).map((e: { displayName: string }) => e.displayName)).toEqual(['Kim Lee']);
    expect(JSON.stringify(b)).not.toContain('@');
  });

  it('filters to the school domain', async () => {
    // Someone from outside the school, with XP.
    const [outsider] = await db.query<{ id: number }>(
      `insert into users (email, display_name, password_hash) values ('pat@gmail.com', 'Pat Public', null) returning id`,
    );
    await db.query(`insert into completions (user_id, lab_id, xp_awarded, hints_used) values ($1, 'switch-basics', 100, 0)`, [outsider!.id]);
    expect(names(await board('all'))).toContain('Pat Public');
    const school = await board('school');
    expect(school.school).toEqual({ name: 'USC', domain: 'school.edu' });
    expect(names(school)).not.toContain('Pat Public');
    expect(names(school)).toContain('Kim Lee');
    expect((await app.inject({ method: 'GET', url: '/api/leaderboard?scope=nope', headers: { cookie } })).statusCode).toBe(400);
  });

  it('lets the admin find, rename, hide and unhide an account', async () => {
    expect((await findUsers(db, 'KIM@')).map((u) => u.id)).toEqual([id]);
    expect(await renameUser(db, 'kim@school.edu', 'Kim L')).toMatchObject({ id, display_name: 'Kim L' });
    await expect(renameUser(db, String(id), 'K')).rejects.toThrow('at least 2 characters');
    await expect(setHidden(db, 'nobody@school.edu', true)).rejects.toThrow('No account matches');

    await setHidden(db, String(id), true);
    expect(names(await board())).not.toContain('Kim L');
    // A hidden account still works.
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode).toBe(200);
    await setHidden(db, 'kim@school.edu', false);
    expect(names(await board())).toContain('Kim L');
  });

  it('deletes the account and everything in it', async () => {
    // Progress in every table that belongs to a student.
    await put('/api/sandbox', { snapshot: Network.fromSnapshot({ version: 1, topology: { devices: [], links: [] }, configs: {} }).snapshot() });
    await post('/api/modules/ip-addressing/lesson', cookie);
    const round = (await post('/api/trainer/subnetting/start', cookie)).json();
    await post(`/api/trainer/rounds/${round.roundId}/finish`, cookie, { answers: round.problems.map(solve) });
    await post('/api/modules/ip-addressing/quiz', cookie);
    await db.query(`insert into goal_weeks (user_id, week, goal) values ($1, '2026-10-19', 3)`, [id]);
    await db.query(`insert into oauth_accounts (provider, subject, user_id) values ('google', 'kim-1', $1)`, [id]);

    const tables = [
      'sessions', 'attempts', 'completions', 'sandboxes', 'module_steps', 'trainer_rounds',
      'quiz_attempts', 'practice_days', 'goal_weeks', 'badges', 'oauth_accounts',
    ];
    const counts = async () =>
      Object.fromEntries(
        await Promise.all(
          tables.map(async (t) => [t, (await db.query<{ n: number }>(`select count(*)::int as n from ${t} where user_id = $1`, [id]))[0]!.n]),
        ),
      );
    for (const [t, n] of Object.entries(await counts())) expect(n, t).toBeGreaterThan(0);

    const del = (payload: unknown) =>
      app.inject({ method: 'DELETE', url: '/api/me', headers: { cookie }, payload: payload as object });
    expect((await del({})).statusCode).toBe(400);
    expect((await del({ confirm: 'yes' })).statusCode).toBe(400);
    expect((await del({ confirm: 'delete' })).statusCode).toBe(204);

    expect(Object.values(await counts()).every((n) => n === 0)).toBe(true);
    expect(await db.query('select 1 from users where id = $1', [id])).toEqual([]);
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode).toBe(401);
  });
});
