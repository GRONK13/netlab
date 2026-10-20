import { Boxes, SquareTerminal, Trophy } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api.ts';
import { Logo } from '../components/Logo.tsx';

export function AuthPage({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await api.login(email, password);
      else await api.register(email, password, displayName);
      await onSignedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="brand big">
          <Logo size={40} />
          NetLab
        </div>
        <h1>Learn networking by configuring real IOS.</h1>
        <p className="lead">Graded labs in your browser, Packet Tracer style. Earn XP, level up, and get CCNA ready.</p>
        <pre className="hero-cli" aria-hidden="true">
          <span className="p">SW1#</span> conf t{'\n'}
          <span className="p">SW1(config)#</span> vlan 10{'\n'}
          <span className="p">SW1(config-vlan)#</span> name SALES{'\n'}
          <span className="p">SW1(config-vlan)#</span> end{'\n'}
          <span className="ok">✓ VLAN 10 exists and is named SALES   +150 XP</span>
        </pre>
        <ul className="features">
          <li>
            <SquareTerminal size={18} /> Real IOS commands, <code>?</code> help and Tab completion
          </li>
          <li>
            <Boxes size={18} /> A sandbox to build your own topologies
          </li>
          <li>
            <Trophy size={18} /> XP, ranks and a class leaderboard
          </li>
        </ul>
      </section>

      <form className="card auth-card" onSubmit={(e) => void submit(e)}>
        <h2>{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
            Sign in
          </button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>
            Create account
          </button>
        </div>
        {mode === 'register' && (
          <label>
            Display name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} required autoComplete="nickname" />
          </label>
        )}
        <label>
          School email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@usc.edu.ph" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === 'register' ? 8 : 1}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {mode === 'register' && <span className="muted small">At least 8 characters.</span>}
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
