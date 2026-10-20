import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api.ts';

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
      <div className="auth-hero">
        <div className="brand big">
          <img src="/favicon.svg" alt="" width={40} height={40} />
          NetLab
        </div>
        <p className="lead">Practice real Cisco IOS commands in graded labs. Earn XP, level up, and get ready for the CCNA.</p>
        <pre className="hero-cli" aria-hidden="true">
          {'SW1# conf t\nSW1(config)# vlan 10\nSW1(config-vlan)# name SALES\nSW1(config-vlan)# end\n'}
          <span className="ok">✓ Objective complete  +150 XP</span>
        </pre>
      </div>
      <form className="card auth-card" onSubmit={(e) => void submit(e)}>
        <div className="tabs" role="tablist">
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
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
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
        </label>
        {mode === 'register' && <p className="muted small">At least 8 characters.</p>}
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
