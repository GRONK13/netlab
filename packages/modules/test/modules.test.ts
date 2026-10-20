import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIp } from '@netlab/sim';
import { describe, expect, it } from 'vitest';
import { getModule, MODULES, TRAINERS, WIDGETS } from '../src/index.ts';
import { ANSWERS, answerText, grade } from '../src/answers/index.ts';

describe.each(MODULES.map((m) => [m.id, m] as const))('module %s', (_, m) => {
  const keys = ANSWERS[m.id]!;

  it('has a key for every question, and no stray keys', () => {
    const ids = m.quiz.questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(keys).sort()).toEqual([...ids].sort());
  });

  it('accepts its own answers and rejects a blank', () => {
    for (const q of m.quiz.questions) {
      const key = keys[q.id]!;
      if (q.kind === 'choice') {
        expect(Number.isInteger(key.answer) && Number(key.answer) < q.choices.length).toBe(true);
      } else if (q.answerType === 'ip') {
        expect(isIp(String(key.answer))).toBe(true);
      }
      expect(answerText(q, key)).not.toBe('');
      expect(grade(q, key, q.kind === 'choice' ? String(key.answer) : answerText(q, key))).toBe(
        true,
      );
      expect(grade(q, key, '')).toBe(false);
      expect(key.explanation.length).toBeGreaterThan(10);
    }
  });

  it("doesn't let 'always pick the same letter' pass", () => {
    const positions = m.quiz.questions.flatMap((q) =>
      q.kind === 'choice' ? [Number(keys[q.id]!.answer)] : [],
    );
    const most = Math.max(...[0, 1, 2, 3].map((p) => positions.filter((x) => x === p).length));
    expect(most).toBeLessThanOrEqual(Math.ceil(positions.length / 3));
  });

  it('draws a sensible quiz', () => {
    expect(m.quiz.pass).toBeLessThanOrEqual(m.quiz.draw);
    // Enough questions that retries see new ones.
    expect(m.quiz.questions.length).toBeGreaterThanOrEqual(m.quiz.draw * 2);
  });

  it('only embeds known widgets and links to a real trainer', () => {
    for (const s of m.lesson) {
      for (const line of s.body.split('\n').filter((l) => l.startsWith(':::'))) {
        expect(WIDGETS).toContain(line.slice(3).trim().split(/\s+/)[0]);
      }
    }
    if (m.trainer) expect(TRAINERS[m.trainer]?.moduleId).toBe(m.id);
    expect(getModule(m.id)).toBe(m);
  });
});

describe('answer key isolation', () => {
  it('grades typed answers forgivingly', () => {
    const m = getModule('ip-addressing')!;
    const q = (id: string) => m.quiz.questions.find((x) => x.id === id)!;
    const key = (id: string) => ANSWERS['ip-addressing']![id]!;
    expect(grade(q('fit-100'), key('fit-100'), '/25')).toBe(true);
    expect(grade(q('hosts-23'), key('hosts-23'), ' 510 ')).toBe(true);
    expect(grade(q('binary-172'), key('binary-172'), '1010 1100')).toBe(true);
    expect(grade(q('net-27'), key('net-27'), '192.168.005.064')).toBe(true);
    expect(grade(q('net-27'), key('net-27'), '192.168.5.65')).toBe(false);
  });

  it('never lets the web app import the answers', () => {
    const web = fileURLToPath(new URL('../../../apps/web/src', import.meta.url));
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? files(p) : [p];
      });
    const offenders = files(web).filter((f) =>
      /modules\/answers|answers\/index/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
