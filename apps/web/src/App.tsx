import { Boxes, LayoutGrid, LogOut, Trophy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Me } from './api.ts';
import { LedMeter } from './components/LevelCard.tsx';
import { Logo } from './components/Logo.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { LabPage } from './pages/LabPage.tsx';
import { LeaderboardPage } from './pages/LeaderboardPage.tsx';
import { SandboxPage } from './pages/SandboxPage.tsx';

type Route = { page: 'home' } | { page: 'lab'; id: string } | { page: 'sandbox' } | { page: 'leaderboard' };

function parseHash(hash: string): Route {
  const lab = /^#\/lab\/([\w-]+)$/.exec(hash);
  if (lab) return { page: 'lab', id: lab[1]! };
  if (hash === '#/sandbox') return { page: 'sandbox' };
  if (hash === '#/leaderboard') return { page: 'leaderboard' };
  return { page: 'home' };
}

const NAV = [
  { href: '#/', page: 'home', label: 'Labs', Icon: LayoutGrid },
  { href: '#/sandbox', page: 'sandbox', label: 'Sandbox', Icon: Boxes },
  { href: '#/leaderboard', page: 'leaderboard', label: 'Leaderboard', Icon: Trophy },
] as const;

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

  // Labs and the sandbox need the whole screen, so the sidebar shrinks to icons.
  const workspace = route.page === 'lab' || route.page === 'sandbox';
  const initials = me.user.displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`shell${workspace ? ' compact' : ''}`}>
      <aside className="sidebar">
        <a href="#/" className="brand" aria-label="NetLab home">
          <Logo />
        </a>
        <nav aria-label="Main">
          {NAV.map(({ href, page, label, Icon }) => {
            const current = route.page === page || (page === 'home' && route.page === 'lab');
            return (
              <a key={href} href={href} className="nav-item" aria-current={current ? 'page' : undefined} title={label}>
                <Icon size={19} />
                <span className="label">{label}</span>
              </a>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="user" title={`${me.user.displayName} · Level ${me.level.level} ${me.level.rank}`}>
            <span className="avatar">{initials}</span>
            <div className="label">
              <div className="user-name">{me.user.displayName}</div>
              <div className="user-meta mono">
                LV{String(me.level.level).padStart(2, '0')} · {me.level.xp} XP
              </div>
              <LedMeter lit={Math.round(me.level.progress * 10)} total={10} label="Level progress" />
            </div>
          </div>
          <button className="nav-item" onClick={() => void signOut()} title="Sign out">
            <LogOut size={18} />
            <span className="label">Sign out</span>
          </button>
        </div>
      </aside>
      <main className="main">
        {route.page === 'home' && <Dashboard me={me} />}
        {route.page === 'lab' && <LabPage key={route.id} labId={route.id} me={me} onProgress={refresh} />}
        {route.page === 'sandbox' && <SandboxPage />}
        {route.page === 'leaderboard' && <LeaderboardPage me={me} />}
      </main>
    </div>
  );
}
