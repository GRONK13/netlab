import { useEffect, useState } from 'react';
import { api, type Leaderboard } from '../api.ts';
import { days } from '../format.ts';

const pad = (n: number) => String(n).padStart(2, '0');

export function LeaderboardPage() {
  const [scope, setScope] = useState<'all' | 'school'>('all');
  const [board, setBoard] = useState<Leaderboard | null>(null);
  // Which school the filter means, from the server; kept while the next board loads.
  const [school, setSchool] = useState<Leaderboard['school'] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setBoard(null);
    setError('');
    api.leaderboard(scope).then(
      (b) => {
        setBoard(b);
        setSchool(b.school);
      },
      () => setError("Couldn't load the leaderboard."),
    );
  }, [scope]);

  return (
    <div className="page">
      <header className="page-head">
        <p className="label-caps">Class standings</p>
        <h1>Leaderboard</h1>
        <p className="muted">Top 20 by XP. Using fewer hints earns more XP per lab. Streak is days of practice in a row; badges are for show.</p>
      </header>
      {school && (
        <div className="segmented" role="group" aria-label="Who to show">
          <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
            Everyone
          </button>
          <button
            type="button"
            aria-pressed={scope === 'school'}
            onClick={() => setScope('school')}
            title={`Accounts with an @${school.domain} email`}
          >
            {school.name} only
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {!board && !error && <p className="muted">Loading…</p>}
      {board && board.entries.length === 0 && (
        <div className="panel empty-state">
          <p>
            {scope === 'school'
              ? `No ${board.school.name} students have earned XP yet. Be the first on the board.`
              : 'No one has finished a lab yet. Be the first on the board.'}
          </p>
        </div>
      )}
      {board && board.entries.length > 0 && (
        <div className="panel table-wrap">
          <table className="board">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th className="hide-sm">Level</th>
                <th className="num">Streak</th>
                <th className="num">Badges</th>
                <th className="num">Labs</th>
                <th className="num">XP</th>
              </tr>
            </thead>
            <tbody>
              {board.entries.map((e) => (
                <tr key={e.place} className={e.you ? 'me' : undefined}>
                  <td className={`place mono${e.place <= 3 ? ' top' : ''}`}>{pad(e.place)}</td>
                  <td className="strong">{e.displayName}</td>
                  <td className="hide-sm">
                    <span className="mono muted">LV{pad(e.level)}</span> {e.rank}
                  </td>
                  <td className="num mono">{e.streak > 0 ? days(e.streak) : '-'}</td>
                  <td className="num mono">{e.badges}</td>
                  <td className="num mono">
                    {e.labs}/{board.totalLabs}
                  </td>
                  <td className="num mono strong">{e.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
