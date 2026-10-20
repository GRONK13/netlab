import type { LevelInfo } from '@netlab/labs';

export function LevelCard({ level }: { level: LevelInfo }) {
  return (
    <div className="card level-card">
      <div>
        <div className="muted small">Level {level.level}</div>
        <div className="rank">{level.rank}</div>
      </div>
      <div className="level-progress">
        <div className="bar" role="progressbar" aria-valuenow={Math.round(level.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${level.progress * 100}%` }} />
        </div>
        <div className="muted small">
          {level.next === null ? `${level.xp} XP · max level` : `${level.xp} / ${level.next} XP to level ${level.level + 1}`}
        </div>
      </div>
    </div>
  );
}
