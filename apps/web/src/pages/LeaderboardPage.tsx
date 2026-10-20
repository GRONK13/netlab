import { Crown, Medal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type Leaderboard, type Me } from '../api.ts';

export function LeaderboardPage({ me }: { me: Me }) {
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.leaderboard().then(setBoard, () => setError("Couldn't load the leaderboard."));
  }, []);

  const top = board?.entries.slice(0, 3) ?? [];
  // Podium order: 2nd, 1st, 3rd.
  const podium = [top[1], top[0], top[2]].filter(Boolean);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Leaderboard</h1>
          <p className="muted">Top students by XP. Finish labs with fewer hints to climb faster.</p>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      {!board && !error && <p className="muted">Loading…</p>}
      {board && board.entries.length === 0 && (
        <div className="card empty-state">
          <Crown size={28} />
          <p>No one has finished a lab yet. Be the first!</p>
        </div>
      )}
      {podium.length > 0 && (
        <div className="podium">
          {podium.map((e) => (
            <div key={e!.place} className={`card podium-card p${e!.place}`}>
              {e!.place === 1 ? <Crown size={22} /> : <Medal size={22} />}
              <div className="podium-name">{e!.displayName}</div>
              <div className="muted small">
                Lv {e!.level} · {e!.rank}
              </div>
              <div className="podium-xp">{e!.xp} XP</div>
            </div>
          ))}
        </div>
      )}
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
                  <td className="place">{e.place}</td>
                  <td>{e.displayName}</td>
                  <td>
                    <span className="chip">Lv {e.level}</span> {e.rank}
                  </td>
                  <td className="num">
                    {e.labs}/{board.totalLabs}
                  </td>
                  <td className="num strong">{e.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
