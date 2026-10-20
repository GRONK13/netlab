import { LABS } from '@netlab/labs';
import { ArrowRight, Boxes, Check, Sparkles, Target } from 'lucide-react';
import type { Me } from '../api.ts';
import { DeviceGlyph } from '../components/DeviceIcon.tsx';
import { LevelCard } from '../components/LevelCard.tsx';

export function Dashboard({ me }: { me: Me }) {
  const done = new Map(me.completions.map((c) => [c.labId, c]));
  const next = LABS.find((l) => !done.has(l.id));
  const first = me.user.displayName.split(/\s+/)[0];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Welcome back, {first}</h1>
          <p className="muted">Practice real Cisco IOS, one lab at a time.</p>
        </div>
      </header>

      <section className="overview">
        <LevelCard level={me.level} />
        <div className="card stat-card">
          <div className="stat-icon green">
            <Target size={20} />
          </div>
          <div>
            <div className="stat-value">
              {done.size}
              <span className="muted">/{LABS.length}</span>
            </div>
            <div className="muted small">Labs completed</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon amber">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="stat-value">{me.level.xp}</div>
            <div className="muted small">Total XP</div>
          </div>
        </div>
      </section>

      {next ? (
        <a href={`#/lab/${next.id}`} className="card continue-card">
          <div>
            <div className="eyebrow">{done.size === 0 ? 'Start here' : 'Up next'}</div>
            <h2>{next.title}</h2>
            <p className="muted">{next.summary}</p>
          </div>
          <span className="btn primary">
            {done.size === 0 ? 'Start lab' : 'Continue'} <ArrowRight size={16} />
          </span>
        </a>
      ) : (
        <div className="card continue-card done">
          <div>
            <div className="eyebrow">All labs complete</div>
            <h2>Nice work! More labs are on the way.</h2>
            <p className="muted">Try building your own network in the sandbox meanwhile.</p>
          </div>
          <a href="#/sandbox" className="btn primary">
            Open sandbox <ArrowRight size={16} />
          </a>
        </div>
      )}

      <div className="section-head">
        <h2>Labs</h2>
        <span className="muted small">
          {done.size} of {LABS.length} complete
        </span>
      </div>
      <div className="lab-list">
        {LABS.map((lab, i) => {
          const c = done.get(lab.id);
          const kinds = [...new Set(lab.topology.devices.map((d) => d.kind))];
          return (
            <a key={lab.id} href={`#/lab/${lab.id}`} className={`card lab-row${c ? ' done' : ''}`}>
              <span className={`lab-num${c ? ' done' : ''}`}>{c ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
              <div className="lab-main">
                <h3>{lab.title}</h3>
                <p className="muted">{lab.summary}</p>
                <div className="chips">
                  <span className={`chip ${lab.difficulty.toLowerCase()}`}>{lab.difficulty}</span>
                  <span className="chip">{lab.ccnaDomain}</span>
                </div>
              </div>
              <div className="lab-devices" aria-hidden="true">
                {kinds.map((k) => (
                  <DeviceGlyph key={k} kind={k} size={34} />
                ))}
              </div>
              <span className={c ? 'xp-earned' : 'xp-avail'}>{c ? `+${c.xpAwarded} XP` : `${lab.xp} XP`}</span>
            </a>
          );
        })}
      </div>

      <a href="#/sandbox" className="card sandbox-promo">
        <div className="stat-icon blue">
          <Boxes size={20} />
        </div>
        <div>
          <strong>Sandbox</strong>
          <p className="muted small">Build any topology you like, cable it up and test it. No grading, no XP, just practice.</p>
        </div>
        <ArrowRight size={18} className="muted" />
      </a>
    </div>
  );
}
