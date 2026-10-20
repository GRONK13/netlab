import { getModule, type Question } from '@netlab/modules';
import { ArrowLeft, Check, CircleCheck, ListChecks, Play, RotateCcw, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ApiError, type Me, type QuizResult } from '../api.ts';
import { Inline } from '../components/Briefing.tsx';

const PLACEHOLDER = { ip: 'a.b.c.d', number: 'number', text: '' } as const;

function Field({
  q,
  value,
  onChange,
  disabled,
}: {
  q: Question;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  if (q.kind === 'choice') {
    return (
      <div className="choices" role="radiogroup" aria-label={q.prompt}>
        {q.choices.map((c, i) => (
          <label key={i} className="choice">
            <input
              type="radio"
              name={`q-${q.id}`}
              value={i}
              checked={value === String(i)}
              onChange={() => onChange(String(i))}
              disabled={disabled}
            />
            <span>{c}</span>
          </label>
        ))}
      </div>
    );
  }
  return (
    <input
      className="quiz-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={q.prompt}
      placeholder={q.placeholder ?? PLACEHOLDER[q.answerType]}
      inputMode={q.answerType === 'text' ? 'text' : 'decimal'}
      autoComplete="off"
      spellCheck={false}
      maxLength={100}
    />
  );
}

/** Checkpoint quiz: questions come from the server without answers; the server grades. */
export function QuizPage({
  moduleId,
  me,
  onProgress,
}: {
  moduleId: string;
  me: Me;
  onProgress: () => Promise<void>;
}) {
  const mod = getModule(moduleId);
  const [attempt, setAttempt] = useState<{ id: number; questions: Question[] } | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!mod) {
    return (
      <div className="page">
        <p>That module doesn't exist.</p>
        <a href="#/">Back home</a>
      </div>
    );
  }
  const passedBefore = me.moduleSteps.some((s) => s.moduleId === mod.id && s.step === 'quiz');
  const { draw, pass, xp, questions } = mod.quiz;

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const a = await api.startQuiz(mod.id);
      setAttempt({ id: a.attemptId, questions: a.questions });
      setAnswers(a.questions.map(() => ''));
      setResult(null);
      scrollTo({ top: 0 });
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Couldn't start the quiz. Check your connection.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!attempt) return;
    const blank = answers.filter((a) => !a.trim()).length;
    if (
      blank > 0 &&
      !confirm(`${blank} question${blank > 1 ? 's are' : ' is'} unanswered. Submit anyway?`)
    )
      return;
    setBusy(true);
    setError('');
    try {
      const r = await api.submitQuiz(attempt.id, answers);
      setResult(r);
      if (r.xpAwarded > 0) await onProgress();
      scrollTo({ top: 0 });
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Couldn't submit. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const answered = answers.filter((a) => a.trim()).length;
  const shown = (q: Question, i: number) => {
    const a = answers[i] ?? '';
    if (!a.trim()) return '(blank)';
    return q.kind === 'choice' ? (q.choices[Number(a)] ?? a) : a;
  };

  return (
    <div className="page quiz-page">
      <header className="page-head">
        <a href={`#/learn/${mod.id}`} className="back-link small">
          <ArrowLeft size={14} /> Module {mod.number}: {mod.title}
        </a>
        <h1>Checkpoint quiz</h1>
        <p className="muted">
          {draw} questions drawn from a pool of {questions.length}. Get {pass} right to pass and
          earn {xp} XP the first time. Retry as often as you like; every try draws new questions.
        </p>
      </header>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className={`result ${result.passed ? 'pass' : 'fail'}`} role="status">
          {result.passed ? <CircleCheck size={20} /> : <ListChecks size={20} />}
          <div>
            <strong>
              {result.correct}/{result.total} correct.{' '}
              {result.passed
                ? result.xpAwarded > 0
                  ? `Passed: +${result.xpAwarded} XP!`
                  : 'Passed again.'
                : `You need ${pass} to pass. The ones marked wrong are below; try again for a new set.`}
            </strong>
          </div>
        </div>
      )}

      {!attempt && (
        <div className="quiz-intro">
          {passedBefore && (
            <p className="done-mark">
              <Check size={14} strokeWidth={3} /> You've passed this quiz. Retake it any time for
              practice.
            </p>
          )}
          <div>
            <button className="btn accent" onClick={() => void start()} disabled={busy}>
              <Play size={16} /> {busy ? 'Drawing questions…' : 'Start the quiz'}
            </button>
          </div>
        </div>
      )}

      {attempt && (
        <form onSubmit={(e) => void submit(e)}>
          <ol className="quiz">
            {attempt.questions.map((q, i) => {
              const graded = result?.results[i];
              const review = result?.review?.find((r) => r.id === q.id);
              return (
                <li key={q.id} className={result ? (graded ? 'right' : 'wrong') : undefined}>
                  <p className="quiz-prompt">
                    <span className="mono muted">{String(i + 1).padStart(2, '0')}</span> {q.prompt}
                  </p>
                  {!result && (
                    <Field
                      q={q}
                      value={answers[i] ?? ''}
                      disabled={busy}
                      onChange={(v) => setAnswers((all) => all.map((a, j) => (j === i ? v : a)))}
                    />
                  )}
                  {result && (
                    <div className="quiz-feedback">
                      <span className={`answer-mark ${graded ? 'ok' : 'bad'}`}>
                        {graded ? (
                          <Check size={14} strokeWidth={3} />
                        ) : (
                          <X size={14} strokeWidth={3} />
                        )}
                        You: {shown(q, i)}
                      </span>
                      {review && (
                        <>
                          {!graded && (
                            <span>
                              Answer: <strong>{review.answer}</strong>
                            </span>
                          )}
                          <span className="muted">
                            <Inline text={review.explanation} />
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {!result ? (
            <div className="quiz-actions">
              <button className="btn accent" disabled={busy}>
                {busy ? 'Checking…' : 'Submit answers'}
              </button>
              <span className="mono small muted">
                {answered}/{attempt.questions.length} answered
              </span>
            </div>
          ) : (
            <div className="quiz-actions">
              <button
                type="button"
                className="btn accent"
                onClick={() => void start()}
                disabled={busy}
              >
                <RotateCcw size={16} /> {result.passed ? 'Take it again' : 'Try again'}
              </button>
              <a className="btn" href={`#/learn/${mod.id}`}>
                Back to the module
              </a>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
