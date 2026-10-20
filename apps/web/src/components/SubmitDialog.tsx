import type { Lab, LevelInfo } from '@netlab/labs';
import { ArrowRight, Check, CircleCheck, ListChecks, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { SubmitResult } from '../api.ts';

export interface NextStep {
  href: string;
  label: string;
}

/**
 * What Submit did: the server's verdict on every objective, the XP earned, and where to go
 * next. The server replays the command log on a fresh network, so this is the real grade.
 */
export function SubmitDialog({
  lab,
  result,
  levelBefore,
  next,
  onClose,
}: {
  lab: Lab;
  result: SubmitResult;
  levelBefore: LevelInfo;
  next: NextStep | null;
  /** `keepWorking` is true when the student should go back to the objectives. */
  onClose: (keepWorking: boolean) => void;
}) {
  // Focus the main action so Enter does the obvious thing.
  const link = useRef<HTMLAnchorElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => (link.current ?? button.current)?.focus(), []);

  const met = result.results.filter(Boolean).length;
  const total = result.results.length;
  const levelUp = result.passed && result.level.level > levelBefore.level;
  const title = !result.passed
    ? 'Not finished yet'
    : result.xpAwarded > 0
      ? `Lab complete! +${result.xpAwarded} XP`
      : 'All objectives met';
  const summary = !result.passed
    ? `${met} of ${total} objectives met. Fix the ones marked with a cross, then submit again.`
    : result.xpAwarded > 0
      ? levelUp
        ? `Level up: you're now level ${result.level.level}, ${result.level.rank}.`
        : `You now have ${result.level.xp} XP.`
      : 'You already earned the XP for this lab, so nothing new was added.';

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose(!result.passed)}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose(!result.passed);
        }}
      >
        <header className={`modal-head ${result.passed ? 'pass' : 'fail'}`}>
          {result.passed ? <CircleCheck size={26} /> : <ListChecks size={26} />}
          <div>
            <h2 id="submit-title">{title}</h2>
            <p>{summary}</p>
          </div>
        </header>

        <ul className="objectives result-list" aria-label="Objectives checked">
          {lab.objectives.map((o, i) => (
            <li key={i} className={result.results[i] ? 'met' : 'missed'}>
              <span className="check" aria-hidden="true">
                {result.results[i] ? (
                  <Check size={12} strokeWidth={3} />
                ) : (
                  <X size={12} strokeWidth={3} />
                )}
              </span>
              <span>{o.label}</span>
              <span className="sr-only">{result.results[i] ? '(met)' : '(not met)'}</span>
            </li>
          ))}
        </ul>

        <p className="muted small">
          Submit sends your commands to the server, which replays them on a fresh copy of this
          network and checks every objective. XP is awarded the first time they all pass.
        </p>

        <div className="modal-actions">
          {!result.passed ? (
            <button ref={button} className="btn accent" onClick={() => onClose(true)}>
              Keep working
            </button>
          ) : (
            <>
              {next && (
                <a ref={link} className="btn accent" href={next.href}>
                  {next.label} <ArrowRight size={16} />
                </a>
              )}
              <button
                ref={button}
                className={next ? 'btn' : 'btn accent'}
                onClick={() => onClose(false)}
              >
                Stay in the lab
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
