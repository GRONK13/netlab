import { getLab, LABS, levelFor, MAX_HINTS, xpAward } from '@netlab/labs';
import { evaluateAll, Network, type LogEntry, type NetworkSnapshot } from '@netlab/sim';
import type { FastifyInstance } from 'fastify';
import { requireUser, SESSION_COOKIE } from './auth.ts';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { displayNameProblem } from './names.ts';
import { badgeCounts, progressFor, recordPractice, streaksFor, syncBadges } from './progress.ts';

export const MAX_LOG = 5000;

const logSchema = {
  type: 'array',
  maxItems: MAX_LOG,
  items: {
    type: 'object',
    required: ['device', 'line'],
    additionalProperties: false,
    properties: {
      device: { type: 'string', maxLength: 32 },
      line: { type: 'string', maxLength: 300 },
    },
  },
} as const;

const logBody = {
  type: 'object',
  required: ['log'],
  additionalProperties: false,
  properties: { log: logSchema },
} as const;

export async function totalXp(db: Db, userId: number): Promise<number> {
  const [r] = await db.query<{ xp: number }>(
    'select coalesce(sum(xp), 0)::int as xp from xp_events where user_id = $1',
    [userId],
  );
  return r?.xp ?? 0;
}

async function saveLog(db: Db, userId: number, labId: string, log: LogEntry[]): Promise<void> {
  await db.query(
    `insert into attempts (user_id, lab_id, command_log) values ($1, $2, $3::jsonb)
     on conflict (user_id, lab_id) do update set command_log = excluded.command_log, updated_at = now()`,
    [userId, labId, JSON.stringify(log)],
  );
}

export function apiRoutes(app: FastifyInstance, db: Db, config: Config): void {
  app.get('/api/me', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const [ways] = await db.query<{ providers: string[] | null; password: boolean }>(
      `select array(select provider from oauth_accounts where user_id = u.id order by provider) as providers,
              u.password_hash is not null as password
       from users u where u.id = $1`,
      [user.id],
    );
    const completions = await db.query<{ lab_id: string; xp_awarded: number; completed_at: string }>(
      'select lab_id, xp_awarded, completed_at from completions where user_id = $1',
      [user.id],
    );
    const steps = await db.query<{ module_id: string; step: string; xp_awarded: number; completed_at: string }>(
      'select module_id, step, xp_awarded, completed_at from module_steps where user_id = $1',
      [user.id],
    );
    return {
      user,
      level: levelFor(await totalXp(db, user.id)),
      progress: await progressFor(db, user.id),
      // How this account signs in: 'google', 'github', and/or 'password'.
      signIn: [...(ways?.providers ?? []), ...(ways?.password ? ['password'] : [])],
      completions: completions.map((c) => ({ labId: c.lab_id, xpAwarded: c.xp_awarded, completedAt: c.completed_at })),
      moduleSteps: steps.map((s) => ({
        moduleId: s.module_id,
        step: s.step,
        xpAwarded: s.xp_awarded,
        completedAt: s.completed_at,
      })),
    };
  });

  app.put<{ Body: { displayName: string } }>(
    '/api/me/name',
    {
      schema: {
        body: {
          type: 'object',
          required: ['displayName'],
          additionalProperties: false,
          properties: { displayName: { type: 'string', maxLength: 40 } },
        },
      },
    },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const displayName = req.body.displayName.trim();
      const problem = displayNameProblem(displayName);
      if (problem) return reply.code(400).send({ error: problem });
      await db.query('update users set display_name = $2 where id = $1', [user.id, displayName]);
      return { user: { ...user, displayName } };
    },
  );

  // Erases the account and, through the foreign keys, everything that belongs to it.
  app.delete<{ Body: { confirm: string } }>(
    '/api/me',
    {
      schema: {
        body: {
          type: 'object',
          required: ['confirm'],
          additionalProperties: false,
          properties: { confirm: { type: 'string', const: 'delete' } },
        },
      },
    },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      await db.query('delete from users where id = $1', [user.id]);
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { id: string } }>('/api/labs/:id/attempt', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    if (!getLab(req.params.id)) return reply.code(404).send({ error: 'No such lab.' });
    const [a] = await db.query<{ command_log: LogEntry[]; hints_used: number }>(
      'select command_log, hints_used from attempts where user_id = $1 and lab_id = $2',
      [user.id, req.params.id],
    );
    const [c] = await db.query('select 1 from completions where user_id = $1 and lab_id = $2', [user.id, req.params.id]);
    return { log: a?.command_log ?? [], hintsUsed: a?.hints_used ?? 0, completed: !!c };
  });

  app.put<{ Params: { id: string }; Body: { log: LogEntry[] } }>(
    '/api/labs/:id/attempt',
    { schema: { body: logBody } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      if (!getLab(req.params.id)) return reply.code(404).send({ error: 'No such lab.' });
      await saveLog(db, user.id, req.params.id, req.body.log);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>('/api/labs/:id/hint', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const lab = getLab(req.params.id);
    if (!lab) return reply.code(404).send({ error: 'No such lab.' });
    const [r] = await db.query<{ hints_used: number }>(
      `insert into attempts (user_id, lab_id, hints_used) values ($1, $2, 1)
       on conflict (user_id, lab_id) do update
         set hints_used = least(attempts.hints_used + 1, $3), updated_at = now()
       returning hints_used`,
      [user.id, lab.id, Math.min(MAX_HINTS, lab.hints.length)],
    );
    return { hintsUsed: r!.hints_used };
  });

  app.post<{ Params: { id: string }; Body: { log: LogEntry[] } }>(
    '/api/labs/:id/submit',
    { schema: { body: logBody } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const lab = getLab(req.params.id);
      if (!lab) return reply.code(404).send({ error: 'No such lab.' });

      // Never trust the browser's verdict: rebuild the network and grade it here.
      await saveLog(db, user.id, lab.id, req.body.log);
      if (req.body.log.length > 0) await recordPractice(db, user.id);
      const net = Network.replay(lab.topology, req.body.log);
      const results = evaluateAll(net, lab.objectives.map((o) => o.check));
      const passed = results.every(Boolean);

      let xpAwarded = 0;
      let alreadyCompleted = false;
      if (passed) {
        const [a] = await db.query<{ hints_used: number }>(
          'select hints_used from attempts where user_id = $1 and lab_id = $2',
          [user.id, lab.id],
        );
        const hints = a?.hints_used ?? 0;
        const inserted = await db.query<{ xp_awarded: number }>(
          `insert into completions (user_id, lab_id, xp_awarded, hints_used) values ($1, $2, $3, $4)
           on conflict (user_id, lab_id) do nothing returning xp_awarded`,
          [user.id, lab.id, xpAward(lab.xp, hints), hints],
        );
        if (inserted[0]) xpAwarded = inserted[0].xp_awarded;
        else alreadyCompleted = true;
      }
      const xp = await totalXp(db, user.id);
      const newBadges = await syncBadges(db, user.id);
      return { passed, results, xpAwarded, alreadyCompleted, level: levelFor(xp), newBadges };
    },
  );

  app.get('/api/sandbox', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const [row] = await db.query<{ data: NetworkSnapshot }>('select data from sandboxes where user_id = $1', [user.id]);
    return { snapshot: row?.data ?? null };
  });

  app.put<{ Body: { snapshot: NetworkSnapshot } }>(
    '/api/sandbox',
    { bodyLimit: 512 * 1024, schema: { body: { type: 'object', required: ['snapshot'], properties: { snapshot: { type: 'object' } } } } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      // Rebuilding it is the validation: bad ids, ports or sizes throw.
      let clean: NetworkSnapshot;
      try {
        clean = Network.fromSnapshot(req.body.snapshot).snapshot();
      } catch (e) {
        return reply.code(400).send({ error: e instanceof Error ? e.message : 'Invalid topology.' });
      }
      await db.query(
        `insert into sandboxes (user_id, data) values ($1, $2::jsonb)
         on conflict (user_id) do update set data = excluded.data, updated_at = now()`,
        [user.id, JSON.stringify(clean)],
      );
      return reply.code(204).send();
    },
  );

  app.get<{ Querystring: { scope?: 'all' | 'school' } }>(
    '/api/leaderboard',
    { schema: { querystring: { type: 'object', properties: { scope: { type: 'string', enum: ['all', 'school'] } } } } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const school = req.query.scope === 'school' ? config.schoolDomain : null;
      // XP counts every source; "labs" counts only the graded labs. Hidden accounts never show.
      const rows = await db.query<{ id: number; display_name: string; xp: number; labs: number }>(
        `select u.id, u.display_name, sum(e.xp)::int as xp,
                count(*) filter (where e.source = 'lab' and e.ref = any($1::text[]))::int as labs
         from xp_events e join users u on u.id = e.user_id
         where not u.hidden and ($2::text is null or split_part(u.email, '@', 2) = $2)
         group by u.id, u.display_name
         having sum(e.xp) > 0
         order by xp desc, max(e.at) filter (where e.xp > 0) asc
         limit 20`,
        [LABS.map((l) => l.id), school],
      );
      const ids = rows.map((r) => r.id);
      const [streaks, badges] = await Promise.all([streaksFor(db, ids), badgeCounts(db, ids)]);
      return {
        totalLabs: LABS.length,
        school: { name: config.schoolName, domain: config.schoolDomain },
        entries: rows.map((r, i) => ({
          place: i + 1,
          displayName: r.display_name,
          you: r.id === user.id,
          xp: r.xp,
          labs: r.labs,
          streak: streaks.get(r.id) ?? 0,
          badges: badges.get(r.id) ?? 0,
          ...(({ level, rank }) => ({ level, rank }))(levelFor(r.xp)),
        })),
      };
    },
  );
}
