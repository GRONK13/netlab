import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Me } from './api.ts';
import { AuthPage } from './pages/AuthPage.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { LabPage } from './pages/LabPage.tsx';
import { LeaderboardPage } from './pages/LeaderboardPage.tsx';

type Route = { page: 'home' } | { page: 'lab'; id: string } | { page: 'leaderboard' };

function parseHash(hash: string): Route {
  const lab = /^#\/lab\/([\w-]+)$/.exec(hash);
  if (lab) return { page: 'lab', id: lab[1]! };
  if (hash === '#/leaderboard') return { page: 'leaderboard' };
  return { page: 'home' };
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<'loading' | 'signed-out' | 'ready' | 'error'>('loading');

  const refresh = useCallback(async () => {
    try {
      setMe(await api.me());
      setStatus('ready');
    } catch (e) {
      setStatus(e instanceof ApiError && e.status === 401 ? 'signed-out' : 'error');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onHash = () => setRoute(parseHash(location.hash));
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, [refresh]);

  if (status === 'loading') return <div className="center muted">Loading…</div>;
  if (status === 'error') {
    return (
      <div className="center">
        <p>Can't reach the NetLab server.</p>
        <button className="btn" onClick={() => void refresh()}>
          Try again
        </button>
      </div>
    );
  }
  if (status === 'signed-out' || !me) return <AuthPage onSignedIn={refresh} />;

  const signOut = async () => {
    await api.logout();
    setMe(null);
    setStatus('signed-out');
  };

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand">
          <img src="/favicon.svg" alt="" width={24} height={24} />
          NetLab
        </a>
        <nav>
          <a href="#/">Labs</a>
          <a href="#/leaderboard">Leaderboard</a>
        </nav>
        <div className="who">
          <span className="pill">
            Lv {me.level.level} · {me.level.xp} XP
          </span>
          <span className="muted hide-sm">{me.user.displayName}</span>
          <button className="btn ghost small" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main>
        {route.page === 'home' && <Dashboard me={me} />}
        {route.page === 'lab' && <LabPage key={route.id} labId={route.id} me={me} onProgress={refresh} />}
        {route.page === 'leaderboard' && <LeaderboardPage me={me} />}
      </main>
    </div>
  );
}
