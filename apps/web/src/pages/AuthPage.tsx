import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Providers } from '../api.ts';
import { Logo } from '../components/Logo.tsx';
import { ProviderMark } from '../components/ProviderMark.tsx';

/** Why the last Google or GitHub sign-in came back to this page (`#/signin?error=...`). */
const SIGNIN_ERRORS: Record<string, string> = {
  cancelled: 'Sign-in was cancelled.',
  expired: 'That sign-in took too long, or was started in another tab. Try again.',
  failed: "Couldn't finish signing in. Try again.",
  'no-email': 'NetLab needs a verified email address on your account. Verify one there, then try again.',
};

function signinError(): string {
  const reason = new URLSearchParams(location.hash.split('?')[1] ?? '').get('error');
  return reason ? (SIGNIN_ERRORS[reason] ?? SIGNIN_ERRORS.failed!) : '';
}

export function AuthPage({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(signinError);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Without the list, email sign-in still works; offer only that, and say how to get the rest.
    api.providers().then(setProviders, () => {
      setProviders({ providers: [], emailSignup: false });
      setError("Couldn't load all the ways to sign in. Reload the page to see them.");
    });
  }, []);

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

  const oauth = providers?.providers ?? [];
  const register = mode === 'register' && providers?.emailSignup !== false;

  return (
    <div className="auth">
      <section className="auth-hero">
        <Logo />
        <h1>Configure real networks. Get graded on the spot.</h1>
        <p className="lead">
          Cisco IOS practice labs in the browser for anyone preparing for the CCNA. Built at the University of San
          Carlos.
        </p>
        <pre className="hero-cli" aria-hidden="true">
          <span className="p">SW1#</span> configure terminal{'\n'}
          <span className="p">SW1(config)#</span> vlan 10{'\n'}
          <span className="p">SW1(config-vlan)#</span> name SALES{'\n'}
          <span className="p">SW1(config-vlan)#</span> end{'\n'}
          <span className="c">! objective met: VLAN 10 is named SALES  [+150 XP]</span>
        </pre>
        <ul className="features">
          <li>Real IOS syntax with <code>?</code> help, Tab completion and <code>--More--</code></li>
          <li>Simulated PCs with a desktop, command prompt and web browser</li>
          <li>A sandbox for building your own topologies</li>
        </ul>
      </section>

      <form className="panel auth-card" onSubmit={(e) => void submit(e)}>
        {oauth.length > 0 && (
          <>
            <div className="auth-intro">
              <h2>Sign in or create an account</h2>
              <p className="muted small">New here? Your account is created the first time you sign in.</p>
            </div>
            <div className="provider-buttons">
              {oauth.map((p) => (
                <a key={p.id} className={`btn block provider ${p.id}`} href={`/api/auth/${p.id}/start`}>
                  <ProviderMark id={p.id} /> Continue with {p.label}
                </a>
              ))}
            </div>
            <div className="auth-or" role="separator">
              <span>{providers?.emailSignup ? 'or use email' : 'or, for older accounts with a password'}</span>
            </div>
          </>
        )}
        {providers?.emailSignup !== false && (
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
              Sign in
            </button>
            <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>
              Create account
            </button>
          </div>
        )}
        {register && (
          <label>
            Display name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} required autoComplete="nickname" />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={register ? 8 : 1}
            required
            autoComplete={register ? 'new-password' : 'current-password'}
          />
          {register && <span className="hint">At least 8 characters.</span>}
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className={`btn block ${oauth.length > 0 ? '' : 'primary'}`} disabled={busy}>
          {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in with email'}
        </button>
        <p className="muted small">
          NetLab stores your email, display name and progress. <a href="#/privacy">How NetLab uses your data</a>
        </p>
      </form>
    </div>
  );
}
