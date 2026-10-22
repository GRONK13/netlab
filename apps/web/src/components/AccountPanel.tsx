import { useState, type FormEvent } from 'react';
import { api, ApiError, type Me } from '../api.ts';

const METHODS: Record<string, string> = { google: 'Google', github: 'GitHub', password: 'email and password' };

/** Change the leaderboard name, see how you sign in, or delete the account. */
export function AccountPanel({ me, onProgress }: { me: Me; onProgress: () => Promise<void> }) {
  const [name, setName] = useState(me.user.displayName);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const rename = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      await api.rename(name);
      await onProgress();
      setStatus('Saved.');
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Couldn't save your name. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deleteAccount();
      location.hash = '#/';
      // Signed out now: the app goes back to the sign-in page.
      await onProgress();
    } catch {
      setDeleteError("Couldn't delete your account. Try again.");
      setDeleting(false);
    }
  };

  const ways = me.signIn.map((m) => METHODS[m] ?? m);

  return (
    <div className="panel account">
      <form className="account-name" onSubmit={(e) => void rename(e)}>
        <label>
          Your name on the leaderboard
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setStatus('');
            }}
            minLength={2}
            maxLength={40}
            required
          />
        </label>
        <button className="btn" disabled={busy || name.trim() === me.user.displayName}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {status && (
          <span className="muted small" role="status">
            {status}
          </span>
        )}
      </form>

      <p className="account-signin">
        <span className="label-caps">Signed in as</span>
        <span>{me.user.email}</span>
        {ways.length > 0 && <span className="muted">using {ways.join(' or ')}</span>}
      </p>

      <form className="account-delete" onSubmit={(e) => void remove(e)}>
        <h3>Delete my account</h3>
        <p className="muted small">
          This erases your account, XP, progress, badges and sandbox for good. It can't be undone.
        </p>
        <label>
          <span>
            Type <strong>delete</strong> to confirm
          </span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </label>
        {deleteError && (
          <p className="error" role="alert">
            {deleteError}
          </p>
        )}
        <div>
          <button className="btn danger" disabled={confirm.trim().toLowerCase() !== 'delete' || deleting}>
            {deleting ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </form>
    </div>
  );
}
