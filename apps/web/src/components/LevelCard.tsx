import type { LevelInfo } from '@netlab/labs';

/** Circular progress toward the next level. */
export function LevelRing({ level, size = 88 }: { level: LevelInfo; size?: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="ring" role="img" aria-label={`Level ${level.level}, ${Math.round(level.progress * 100)}% to the next level`}>
      <circle cx="50" cy="50" r={r} className="ring-track" />
      <circle
        cx="50"
        cy="50"
        r={r}
        className="ring-fill"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - level.progress)}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="47" textAnchor="middle" className="ring-label">
        LV
      </text>
      <text x="50" y="67" textAnchor="middle" className="ring-value">
        {level.level}
      </text>
    </svg>
  );
}

export function LevelCard({ level }: { level: LevelInfo }) {
  return (
    <div className="card level-card">
      <LevelRing level={level} />
      <div>
        <div className="eyebrow">Your rank</div>
        <div className="rank">{level.rank}</div>
        <div className="muted small">
          {level.next === null ? `${level.xp} XP · max level` : `${level.next - level.xp} XP to level ${level.level + 1}`}
        </div>
      </div>
    </div>
  );
}
