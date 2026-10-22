import { isCorrect, solve, type Problem } from '@netlab/modules';
import { Check, CircleCheck, ListChecks, Play, RotateCcw, Timer, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, type TrainerBest, type TrainerInfo, type TrainerResult } from '../api.ts';
import { LedMeter } from '../components/LevelCard.tsx';
import { NewBadges } from '../components/NewBadges.tsx';

const KIND = 'subnetting';

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const bestText = (b: TrainerBest | null, total: number) =>
  b ? `${b.correct}/${total} in ${clock(b.durationMs)}` : 'No rounds yet';

interface Round {
  id: number;
  problems: Problem[];
  startedAt: number;
}

/** Timed subnetting drills. The browser checks answers for instant feedback; the server re-grades and times the round. */
export function TrainerPage({ onProgress }: { onProgress: () => Promise<void> }) {
  const [info, setInfo] = useState<TrainerInfo | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [input, setInput] = useState('');
  // After a wrong answer, the right one stays on screen until the student presses Enter.
  const [reveal, setReveal] = useState(false);
  const [result, setResult] = useState<TrainerResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.trainer(KIND).then(setInfo, () => setError("Couldn't load the trainer."));
  }, []);

  useEffect(() => {
    if (!round || result) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [round, result]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [round, answers.length]);

  const begin = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api.startRound(KIND);
      setRound({ id: r.roundId, problems: r.problems, startedAt: Date.now() });
      setAnswers([]);
      setInput('');
      setReveal(false);
      setResult(null);
      setNow(Date.now());
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Couldn't start a round. Check your connection.",
      );
    } finally {
      setBusy(false);
    }
  };

  const end = async (all: string[]) => {
    if (!round) return;
    setBusy(true);
    try {
      const r = await api.finishRound(round.id, all);
      setResult(r);
      setInfo((i) => i && { ...i, best: r.best, earned: i.earned || r.xpAwarded > 0 });
      if (r.xpAwarded > 0) await onProgress();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Couldn't submit the round. Check your connection.",
      );
    } finally {
      setBusy(false);
    }
  };

  const next = (all: string[]) => {
    setInput('');
    setReveal(false);
    if (round && all.length === round.problems.length) void end(all);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!round || busy || result) return;
    if (reveal) return next(answers);
    const all = [...answers, input.trim()];
    setAnswers(all);
    if (isCorrect(round.problems[answers.length]!, input)) next(all);
    else setReveal(true);
  };

  const spec = info?.spec;
  const stats = info && spec && (
    <section className="status-panel" aria-label="Trainer stats">
      <div className="stat">
        <span className="label-caps">Personal best</span>
        <span className="stat-big mono">
          {info.best ? `${info.best.correct}/${spec.problems}` : '--'}
        </span>
        <span className="stat-sub">
          {info.best ? clock(info.best.durationMs) : 'No rounds yet'}
        </span>
      </div>
      <div className="stat">
        <span className="label-caps">Target</span>
        <span className="stat-big mono">
          {spec.target}/{spec.problems}
        </span>
        <span className="stat-sub">within {clock(spec.limitMs)}</span>
      </div>
      <div className="stat grow">
        <span className="label-caps">Reward</span>
        <span className="stat-big mono">{spec.xp} XP</span>
        <span className="stat-sub">
          {info.earned ? (
            <span className="done-mark">
              <Check size={13} strokeWidth={3} /> Earned. Keep practising to beat your best.
            </span>
          ) : (
            'The first time you hit the target'
          )}
        </span>
      </div>
    </section>
  );

  return (
    <div className="page">
      <header className="page-head">
        <p className="label-caps">Module 1 · IP addressing</p>
        <h1>Subnetting trainer</h1>
        {spec && (
          <p className="muted">
            {spec.problems} problems against the clock. Get {spec.target} right within{' '}
            {clock(spec.limitMs)} to earn {spec.xp} XP.
          </p>
        )}
      </header>

      {error && <p className="error">{error}</p>}
      {!info && !error && <p className="muted">Loading…</p>}

      {info && !round && (
        <>
          {stats}
          <div className="note">
            <h2 className="label-caps">What you'll get</h2>
            <ul>
              <li>Network and broadcast addresses, first and last usable hosts</li>
              <li>Usable hosts for a prefix or mask, masks to prefixes and back</li>
              <li>The smallest subnet that fits a number of hosts</li>
            </ul>
            <p className="muted small">
              Type addresses like <code>192.168.1.0</code> and prefixes like <code>26</code> or{' '}
              <code>/26</code>. A wrong answer shows the right one; press Enter to move on.
            </p>
          </div>
          <div>
            <button className="btn accent" onClick={() => void begin()} disabled={busy}>
              <Play size={16} /> {busy ? 'Starting…' : 'Start a round'}
            </button>
          </div>
        </>
      )}

      {round && !result && (
        <section className="trainer-card" aria-label="Current problem">
          <div className="trainer-top">
            <span className="mono small">
              Problem {Math.min(answers.length + (reveal ? 0 : 1), round.problems.length)}/
              {round.problems.length}
            </span>
            <LedMeter
              lit={answers.length}
              total={round.problems.length}
              label="Problems answered"
            />
            <span className="grow" />
            <span
              className={`trainer-clock${spec && now - round.startedAt > spec.limitMs ? ' over' : ''}`}
              role="timer"
            >
              <Timer size={16} /> {clock(now - round.startedAt)}
            </span>
          </div>
          {(() => {
            const p = round.problems[reveal ? answers.length - 1 : answers.length];
            if (!p) return <p className="muted">Checking your round…</p>;
            return (
              <>
                <p className="trainer-prompt">{p.prompt}</p>
                <form className="trainer-form" onSubmit={submit}>
                  <input
                    ref={inputRef}
                    value={reveal ? answers[answers.length - 1] : input}
                    onChange={(e) => setInput(e.target.value)}
                    readOnly={reveal}
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={40}
                    aria-label={p.answer === 'ip' ? 'Answer (address)' : 'Answer (number)'}
                    placeholder={p.answer === 'ip' ? 'a.b.c.d' : 'number'}
                  />
                  <button className="btn accent" disabled={busy}>
                    {reveal ? 'Next' : 'Check'}
                  </button>
                </form>
                <p className="trainer-feedback" role="status">
                  {reveal && (
                    <span className="bad">
                      <X size={15} strokeWidth={3} /> Not quite. The answer is{' '}
                      <code>{solve(p)}</code>
                    </span>
                  )}
                </p>
              </>
            );
          })()}
          <div>
            <button className="btn ghost small" onClick={() => void end(answers)} disabled={busy}>
              End round
            </button>
          </div>
        </section>
      )}

      {result && round && (
        <>
          <div className={`result ${result.qualified ? 'pass' : 'fail'}`} role="status">
            {result.qualified ? <CircleCheck size={20} /> : <ListChecks size={20} />}
            <div>
              <strong>
                {result.correct}/{result.total} in {clock(result.durationMs)}.{' '}
                {result.xpAwarded > 0
                  ? `Target hit: +${result.xpAwarded} XP!`
                  : result.qualified
                    ? 'Target hit again.'
                    : `The target is ${spec?.target}/${result.total} within ${clock(spec?.limitMs ?? 0)}.`}
              </strong>
              <div>Personal best: {bestText(result.best, result.total)}</div>
            </div>
          </div>
          <NewBadges ids={result.newBadges} />
          <div className="panel table-wrap">
            <table className="board">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Problem</th>
                  <th>You</th>
                  <th>Answer</th>
                </tr>
              </thead>
              <tbody>
                {round.problems.map((p, i) => (
                  <tr key={i}>
                    <td className="mono">{i + 1}</td>
                    <td>{p.prompt}</td>
                    <td className="mono">
                      <span className={`answer-mark ${result.results[i] ? 'ok' : 'bad'}`}>
                        {result.results[i] ? (
                          <Check size={13} strokeWidth={3} />
                        ) : (
                          <X size={13} strokeWidth={3} />
                        )}
                        {answers[i] || '(blank)'}
                      </span>
                    </td>
                    <td className="mono">{result.answers[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {stats}
          <div>
            <button className="btn accent" onClick={() => void begin()} disabled={busy}>
              <RotateCcw size={16} /> New round
            </button>
          </div>
        </>
      )}
    </div>
  );
}
