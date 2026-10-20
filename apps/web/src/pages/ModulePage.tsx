import { getModule } from '@netlab/modules';
import { ArrowRight, Check } from 'lucide-react';
import type { Me } from '../api.ts';
import { LedMeter } from '../components/LevelCard.tsx';
import { stepsFor } from '../moduleSteps.ts';

const pad = (n: number) => String(n).padStart(2, '0');

/** A module's path: its steps in order, with progress. Nothing is locked. */
export function ModulePage({ moduleId, me }: { moduleId: string; me: Me }) {
  const mod = getModule(moduleId);
  if (!mod) {
    return (
      <div className="page">
        <p>That module doesn't exist.</p>
        <a href="#/">Back home</a>
      </div>
    );
  }
  const steps = stepsFor(mod, me);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const xp = steps.reduce((sum, s) => sum + s.xp, 0);

  return (
    <div className="page">
      <header className="page-head">
        <p className="label-caps">
          Module {pad(mod.number)} · {mod.ccnaDomain}
        </p>
        <h1>{mod.title}</h1>
        <p className="muted">{mod.summary}</p>
      </header>

      <section className="status-panel" aria-label="Module progress">
        <div className="stat grow">
          <span className="label-caps">{next ? 'Progress' : 'Module complete'}</span>
          <LedMeter lit={done} total={steps.length} label="Steps done" />
          <span className="stat-sub mono">
            {done}/{steps.length} steps · up to {xp} XP
          </span>
        </div>
        {next && (
          <div className="stat stat-action">
            <a className="btn accent" href={next.href}>
              {done === 0 ? 'Start' : 'Next'}: {next.title} <ArrowRight size={16} />
            </a>
          </div>
        )}
      </section>

      <ol className="lab-table">
        {steps.map((s, i) => (
          <li key={s.key}>
            <a href={s.href} className={`lab-line step-line${s.done ? ' done' : ''}`}>
              <span className="lab-idx mono">{pad(i + 1)}</span>
              <span className="lab-name">
                <strong>{s.title}</strong>
                <span className="muted">{s.description}</span>
              </span>
              <span className="lab-xp mono">{s.xp > 0 ? `${s.xp} XP` : ''}</span>
              <span className="lab-state">
                {s.done ? (
                  <span className="done-mark">
                    <Check size={14} strokeWidth={3} /> Done
                  </span>
                ) : (
                  <ArrowRight size={16} />
                )}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
