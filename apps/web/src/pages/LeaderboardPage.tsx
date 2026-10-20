import { useEffect, useState } from 'react';
import { api, type Leaderboard, type Me } from '../api.ts';

export function LeaderboardPage({ me }: { me: Me }) {
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.leaderboard().then(setBoard, () => setError("Couldn't load the leaderboard."));
  }, []);

  return (
    <div className="page">
      <h1>Leaderboard</h1>
      {error && <p className="error">{error}</p>}
      {board && board.entries.length === 0 && <p className="muted">No one has finished a lab yet. Be the first!</p>}
      {board && board.entries.length > 0 && (
        <div className="card table-wrap">
          <table className="board">
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Rank</th>
                <th className="num">Labs</th>
                <th className="num">XP</th>
              </tr>
            </thead>
            <tbody>
              {board.entries.map((e) => (
                <tr key={e.place} className={e.displayName === me.user.displayName ? 'me' : undefined}>
                  <td>{e.place <= 3 ? ['🥇', '🥈', '🥉'][e.place - 1] : e.place}</td>
                  <td>{e.displayName}</td>
                  <td>
                    <span className="muted small">Lv {e.level}</span> {e.rank}
                  </td>
                  <td className="num">
                    {e.labs}/{board.totalLabs}
                  </td>
                  <td className="num">{e.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
