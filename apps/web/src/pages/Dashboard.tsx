import { LABS } from '@netlab/labs';
import type { Me } from '../api.ts';
import { LevelCard } from '../components/LevelCard.tsx';

export function Dashboard({ me }: { me: Me }) {
  const done = new Map(me.completions.map((c) => [c.labId, c]));
  return (
    <div className="page">
      <h1>Welcome back, {me.user.displayName}</h1>
      <LevelCard level={me.level} />
      <h2>
        Labs <span className="muted small">{done.size} of {LABS.length} complete</span>
      </h2>
      <div className="lab-grid">
        {LABS.map((lab, i) => {
          const c = done.get(lab.id);
          return (
            <a key={lab.id} href={`#/lab/${lab.id}`} className={`card lab-card${c ? ' done' : ''}`}>
              <div className="lab-card-top">
                <span className="muted small">Lab {i + 1}</span>
                <span className={`tag ${lab.difficulty.toLowerCase()}`}>{lab.difficulty}</span>
              </div>
              <h3>{lab.title}</h3>
              <p className="muted">{lab.summary}</p>
              <div className="lab-card-foot">
                <span className="tag">{lab.ccnaDomain}</span>
                <span className={c ? 'ok' : 'xp'}>{c ? `✓ +${c.xpAwarded} XP` : `${lab.xp} XP`}</span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
