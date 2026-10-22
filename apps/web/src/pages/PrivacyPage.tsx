import { ArrowLeft } from 'lucide-react';

/** Where questions and deletion requests go. Shown on the page. */
export const CONTACT_EMAIL = 'gregg.marayan@gmail.com';

/** What NetLab stores and why. Reachable signed in or out. */
export function PrivacyPage({ signedIn }: { signedIn: boolean }) {
  return (
    <div className={signedIn ? 'page' : 'page standalone'}>
      <header className="page-head">
        <a href="#/" className="back-link small">
          <ArrowLeft size={14} /> {signedIn ? 'Back to NetLab' : 'Back to sign in'}
        </a>
        <p className="label-caps">Privacy</p>
        <h1>How NetLab uses your data</h1>
        <p className="muted">
          NetLab is a free CCNA practice site, built as a student project at the University of San Carlos. It keeps
          only what it needs to run.
        </p>
      </header>

      <section className="panel prose">
        <h2>What NetLab stores</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your email address, your display name, and how you sign in (Google,
            GitHub, or a password, which is stored only as a one-way hash).
          </li>
          <li>
            <strong>Your progress:</strong> the commands you type in labs and the sandbox, lab, quiz and trainer
            results, XP, practice days and badges.
          </li>
          <li>
            <strong>Server logs:</strong> requests with your IP address, used to keep the site secure and working.
          </li>
        </ul>

        <h2>From Google or GitHub</h2>
        <p>
          NetLab asks for your basic profile and email address, and keeps only your name, email address and account
          ID. It never sees your password, and it can't read your files, email or repositories.
        </p>

        <h2>Why</h2>
        <p>
          To sign you in, save your work, grade your labs and show the leaderboard. NetLab has no ads or trackers,
          and it never sells or shares your data.
        </p>

        <h2>What other people see</h2>
        <p>
          The leaderboard shows your display name, level, XP, labs done, streak and badges. Your email address is
          never shown to anyone.
        </p>

        <h2>How long it's kept</h2>
        <p>
          Until you delete your account. Nightly backups are kept for 14 days, so deleted data is gone from them
          after two weeks.
        </p>

        <h2>Deleting your account, and questions</h2>
        <p>
          To delete your account and everything in it, or to ask anything about your data, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </div>
  );
}
