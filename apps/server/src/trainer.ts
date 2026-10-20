// Speed trainer rounds. The server picks the seed and keeps the clock: on finish it
// rebuilds the round from the seed, grades the answers and times it itself.

import { randomInt } from 'node:crypto';
import { levelFor } from '@netlab/labs';
import { getTrainer, isCorrect, makeRound, solve } from '@netlab/modules';
import type { FastifyInstance } from 'fastify';
import { requireUser, SESSION_COOKIE } from './auth.ts';
import type { Db } from './db.ts';
import { totalXp } from './routes.ts';

interface Best {
  correct: number;
  durationMs: number;
}

async function bestRound(db: Db, userId: number, kind: string): Promise<Best | null> {
  const [r] = await db.query<{ correct: number; duration_ms: number }>(
    `select correct, duration_ms from trainer_rounds
     where user_id = $1 and kind = $2 and finished_at is not null
     order by correct desc, duration_ms asc limit 1`,
    [userId, kind],
  );
  return r ? { correct: r.correct, durationMs: r.duration_ms } : null;
}

const kindParams = {
  type: 'object',
  required: ['kind'],
  properties: { kind: { type: 'string', maxLength: 32 } },
} as const;

export function trainerRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Params: { kind: string } }>(
    '/api/trainer/:kind',
    { schema: { params: kindParams } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const spec = getTrainer(req.params.kind);
      if (!spec) return reply.code(404).send({ error: 'No such trainer.' });
      const [earned] = await db.query(
        `select 1 from module_steps where user_id = $1 and module_id = $2 and step = 'trainer'`,
        [user.id, spec.moduleId],
      );
      return { spec, best: await bestRound(db, user.id, spec.kind), earned: !!earned };
    },
  );

  app.post<{ Params: { kind: string } }>(
    '/api/trainer/:kind/start',
    {
      schema: { params: kindParams },
      // Per session: every round is a row, so cap how fast they can be created.
      config: {
        rateLimit: {
          max: 120,
          timeWindow: '1 hour',
          keyGenerator: (req) => req.cookies[SESSION_COOKIE] ?? req.ip,
        },
      },
    },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const spec = getTrainer(req.params.kind);
      if (!spec) return reply.code(404).send({ error: 'No such trainer.' });
      const seed = randomInt(0, 2 ** 31 - 1);
      const [row] = await db.query<{ id: number }>(
        'insert into trainer_rounds (user_id, kind, seed) values ($1, $2, $3) returning id',
        [user.id, spec.kind, seed],
      );
      return { roundId: row!.id, problems: makeRound(seed, spec.problems) };
    },
  );

  app.post<{ Params: { id: number }; Body: { answers: string[] } }>(
    '/api/trainer/rounds/:id/finish',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'integer', minimum: 1, maximum: 2147483647 } },
        },
        body: {
          type: 'object',
          required: ['answers'],
          additionalProperties: false,
          properties: {
            answers: { type: 'array', maxItems: 50, items: { type: 'string', maxLength: 40 } },
          },
        },
      },
    },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const [round] = await db.query<{ kind: string; seed: number }>(
        'select kind, seed from trainer_rounds where id = $1 and user_id = $2',
        [req.params.id, user.id],
      );
      const spec = round && getTrainer(round.kind);
      if (!round || !spec) return reply.code(404).send({ error: 'No such round.' });

      const problems = makeRound(round.seed, spec.problems);
      const results = problems.map((p, i) => isCorrect(p, req.body.answers[i] ?? ''));
      const correct = results.filter(Boolean).length;
      // Only the first finish counts; the clock is the database's, not the browser's.
      const [done] = await db.query<{ duration_ms: number }>(
        `update trainer_rounds
         set finished_at = now(), correct = $3,
             duration_ms = least(extract(epoch from now() - started_at) * 1000, 2147483647)::int
         where id = $1 and user_id = $2 and finished_at is null
         returning duration_ms`,
        [req.params.id, user.id, correct],
      );
      if (!done) return reply.code(409).send({ error: 'This round was already finished.' });

      const qualified = correct >= spec.target && done.duration_ms <= spec.limitMs;
      let xpAwarded = 0;
      if (qualified) {
        const [step] = await db.query<{ xp_awarded: number }>(
          `insert into module_steps (user_id, module_id, step, xp_awarded) values ($1, $2, 'trainer', $3)
           on conflict do nothing returning xp_awarded`,
          [user.id, spec.moduleId, spec.xp],
        );
        xpAwarded = step?.xp_awarded ?? 0;
      }
      return {
        correct,
        total: problems.length,
        results,
        answers: problems.map(solve),
        durationMs: done.duration_ms,
        qualified,
        xpAwarded,
        best: await bestRound(db, user.id, spec.kind),
        level: levelFor(await totalXp(db, user.id)),
      };
    },
  );
}
