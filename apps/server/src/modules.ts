// Learning modules: lesson progress and checkpoint quizzes. Quiz answer keys live only
// here on the server (`@netlab/modules/answers`); the browser gets questions without them.

import { randomInt } from 'node:crypto';
import { levelFor } from '@netlab/labs';
import { getModule } from '@netlab/modules';
import { ANSWERS, answerText, grade } from '@netlab/modules/answers';
import type { FastifyInstance } from 'fastify';
import { requireUser, SESSION_COOKIE } from './auth.ts';
import type { Db } from './db.ts';
import { recordPractice } from './progress.ts';
import { totalXp } from './routes.ts';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', maxLength: 40 } },
} as const;

/** n distinct items in random order (Fisher–Yates with a CSPRNG). */
function draw<T>(items: readonly T[], n: number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out.slice(0, n);
}

export function moduleRoutes(app: FastifyInstance, db: Db): void {
  app.post<{ Params: { id: string } }>(
    '/api/modules/:id/lesson',
    { schema: { params: idParams } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const mod = getModule(req.params.id);
      if (!mod) return reply.code(404).send({ error: 'No such module.' });
      const [read] = await db.query(
        `insert into module_steps (user_id, module_id, step, xp_awarded) values ($1, $2, 'lesson', 0)
       on conflict do nothing returning 1`,
        [user.id, mod.id],
      );
      // Only the first read is practice; re-sending it isn't.
      if (read) await recordPractice(db, user.id);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/modules/:id/quiz',
    {
      schema: { params: idParams },
      // Per session, so a class sharing one IP isn't limited together.
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 hour',
          keyGenerator: (req) => req.cookies[SESSION_COOKIE] ?? req.ip,
        },
      },
    },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const mod = getModule(req.params.id);
      if (!mod) return reply.code(404).send({ error: 'No such module.' });
      const questions = draw(mod.quiz.questions, mod.quiz.draw);
      const [row] = await db.query<{ id: number }>(
        'insert into quiz_attempts (user_id, module_id, question_ids) values ($1, $2, $3::jsonb) returning id',
        [user.id, mod.id, JSON.stringify(questions.map((q) => q.id))],
      );
      return { attemptId: row!.id, questions, pass: mod.quiz.pass };
    },
  );

  app.post<{ Params: { id: number }; Body: { answers: string[] } }>(
    '/api/quiz/:id/submit',
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
            answers: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 100 } },
          },
        },
      },
    },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const [attempt] = await db.query<{
        module_id: string;
        question_ids: string[];
        submitted: boolean;
        expired: boolean;
      }>(
        `select module_id, question_ids, submitted_at is not null as submitted,
                started_at < now() - interval '2 hours' as expired
         from quiz_attempts where id = $1 and user_id = $2`,
        [req.params.id, user.id],
      );
      const mod = attempt && getModule(attempt.module_id);
      if (!attempt || !mod) return reply.code(404).send({ error: 'No such quiz attempt.' });
      if (attempt.submitted)
        return reply.code(409).send({ error: 'This attempt was already submitted.' });
      if (attempt.expired)
        return reply.code(410).send({ error: 'This attempt expired. Start a new one.' });

      const keys = ANSWERS[mod.id] ?? {};
      const asked = attempt.question_ids.map((id) => mod.quiz.questions.find((q) => q.id === id));
      // A question removed from the pool since the attempt started counts as wrong.
      const results = asked.map(
        (q, i) => !!q && !!keys[q.id] && grade(q, keys[q.id]!, req.body.answers[i] ?? ''),
      );
      const correct = results.filter(Boolean).length;
      const passed = correct >= mod.quiz.pass;

      const [done] = await db.query(
        `update quiz_attempts set submitted_at = now(), correct = $3, passed = $4
         where id = $1 and user_id = $2 and submitted_at is null returning id`,
        [req.params.id, user.id, correct, passed],
      );
      if (!done) return reply.code(409).send({ error: 'This attempt was already submitted.' });
      if (correct > 0) await recordPractice(db, user.id);

      let xpAwarded = 0;
      if (passed) {
        const [step] = await db.query<{ xp_awarded: number }>(
          `insert into module_steps (user_id, module_id, step, xp_awarded) values ($1, $2, 'quiz', $3)
           on conflict do nothing returning xp_awarded`,
          [user.id, mod.id, mod.quiz.xp],
        );
        xpAwarded = step?.xp_awarded ?? 0;
      }
      return {
        correct,
        total: asked.length,
        passed,
        results,
        xpAwarded,
        // Correct answers and explanations only after a pass, so failing can't be used to harvest them.
        review: passed
          ? asked.flatMap((q) => {
              const key = q && keys[q.id];
              return q && key
                ? [{ id: q.id, answer: answerText(q, key), explanation: key.explanation }]
                : [];
            })
          : null,
        level: levelFor(await totalXp(db, user.id)),
      };
    },
  );
}
