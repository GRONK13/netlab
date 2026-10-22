import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type PendingSignup } from '../api.ts';
import { Logo } from '../components/Logo.tsx';

/** A first Google or GitHub sign-in: choose the name others see, then the account is created. */
export function WelcomePage({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [pending, setPending] = useState<PendingSignup | null>(null);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.pendingSignup().then(
      (p) => {
        setPending(p);
        setName(p.suggestedName);
      },
      () => setMissing(true),
    );
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.completeSignup(name);
      location.hash = '#/';
      await onSignedIn();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center-page">
      <form className="panel auth-card welcome" onSubmit={(e) => void submit(e)}>
        <Logo />
        {missing ? (
          <>
            <h1>This sign-up has expired</h1>
            <p className="muted">Sign-ups wait 15 minutes for a name. Start again and it only takes a moment.</p>
            <a className="btn primary block" href="#/">
              Back to sign in
            </a>
          </>
        ) : !pending ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className="auth-intro">
              <h1>Welcome to NetLab</h1>
              <p className="muted">
                You're signing up with {pending.provider} as <strong>{pending.email}</strong>.
              </p>
            </div>
            <label>
              Your name on the leaderboard
              <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required autoFocus />
              <span className="hint">Everyone can see it. A nickname is fine, and you can change it later.</span>
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary block" disabled={busy}>
              {busy ? 'Creating your account…' : 'Create my account'}
            </button>
            <p className="muted small">
              Your email stays private. <a href="#/privacy">How NetLab uses your data</a>
            </p>
          </>
        )}
      </form>
    </div>
  );
}
