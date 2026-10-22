import { BADGES, GOAL_MAX, GOAL_MIN, masteryByDomain } from '@netlab/modules';
import { useState } from 'react';
import { api, type Me } from '../api.ts';
import { AccountPanel } from '../components/AccountPanel.tsx';
import { BadgeIcon } from '../components/BadgeIcon.tsx';
import { LedMeter } from '../components/LevelCard.tsx';
import { WeekStrip } from '../components/WeekStrip.tsx';
import { dateOf, days, dayWord } from '../format.ts';
import { doneFor } from '../moduleSteps.ts';

const GOALS = Array.from({ length: GOAL_MAX - GOAL_MIN + 1 }, (_, i) => GOAL_MIN + i);

export function ProgressPage({ me, onProgress }: { me: Me; onProgress: () => Promise<void> }) {
  const { today, streak, week } = me.progress;
  const mastery = masteryByDomain(doneFor(me));
  const earned = new Map(me.progress.badges.map((b) => [b.id, b.earnedAt]));
  // The goal being saved, shown as chosen until the server confirms it.
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState('');

  const changeGoal = async (goal: number) => {
    setPending(goal);
    setError('');
    try {
      await api.setGoal(goal);
      await onProgress();
    } catch {
      setError("Couldn't save your goal. Try again.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <p className="label-caps">Your practice</p>
        <h1>Progress</h1>
        <p className="muted">
          A little practice on most days beats one long session. Any day you submit a lab or quiz, finish a trainer
          round or read a new lesson counts.
        </p>
      </header>

      <section className="status-panel" aria-label="Streak and this week">
        <div className="stat">
          <span className="label-caps">Streak</span>
          <span className="stat-big mono">
            {String(streak.current).padStart(2, '0')}
            <small> {dayWord(streak.current)}</small>
          </span>
          <span className="stat-sub">Longest: {days(streak.longest)}</span>
        </div>
        <div className="stat grow">
          <span className="label-caps">This week</span>
          <WeekStrip week={week} today={today} />
          <span className="stat-sub">
            {week.count} of {days(week.goal)}
            {week.met && '. Goal met!'}
          </span>
        </div>
        <div className="stat">
          <span className="label-caps">Streak saver</span>
          <span className="stat-big saver">{streak.freeMissUsed ? 'Used' : 'Ready'}</span>
          <span className="stat-sub">One missed day a week won't break your streak.</span>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Weekly goal</h2>
          <span className="mono muted small">Weeks run Monday to Sunday</span>
        </div>
        <fieldset className="panel goal-picker" disabled={pending !== null}>
          <legend>How many days a week do you want to practise?</legend>
          <div className="goal-choices">
            {GOALS.map((g) => (
              <label key={g} className="choice">
                <input
                  type="radio"
                  name="goal"
                  value={g}
                  checked={(pending ?? week.goal) === g}
                  onChange={() => void changeGoal(g)}
                />
                {days(g)}
              </label>
            ))}
          </div>
          <p className="muted small">
            A new goal counts from this week. Days follow Philippine time, so a day ends at midnight in Manila.
          </p>
          {error && <p className="error">{error}</p>}
        </fieldset>
      </section>

      <section>
        <div className="section-head">
          <h2>Mastery by CCNA domain</h2>
          <span className="mono muted small">CCNA 200-301</span>
        </div>
        <ol className="panel mastery-list">
          {mastery.map((d) => (
            <li key={d.domain}>
              <span className="mastery-name">
                <strong>{d.domain}</strong>
                <span className="muted small">{d.weight}% of the exam</span>
              </span>
              {d.total === 0 ? (
                <span className="muted small mastery-soon">Coming soon</span>
              ) : (
                <>
                  <LedMeter lit={d.done} total={d.total} label={`${d.domain}: ${d.done} of ${d.total} done`} />
                  <span className="mono mastery-count">
                    {d.done}/{d.total}
                  </span>
                </>
              )}
            </li>
          ))}
        </ol>
        <p className="muted small">
          Every lesson, guided practice, trainer, quiz and challenge counts toward its module's domain.
        </p>
      </section>

      <section>
        <div className="section-head">
          <h2>Badges</h2>
          <span className="mono muted small">
            {earned.size} of {BADGES.length} earned
          </span>
        </div>
        <ul className="badge-grid">
          {BADGES.map((b) => {
            const at = earned.get(b.id);
            return (
              <li key={b.id} className={at ? 'earned' : 'locked'}>
                <span className="badge-mark">
                  <BadgeIcon name={b.icon} />
                </span>
                <span className="badge-text">
                  <strong>{b.name}</strong>
                  <span className="muted small">{b.description}</span>
                  <span className="mono small badge-state">
                    {at ? `Earned ${dateOf(at)}` : 'Not yet'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="muted small">Badges are for show: they don't add XP.</p>
      </section>

      <section>
        <div className="section-head">
          <h2>Account</h2>
          <a href="#/privacy" className="mono muted small">
            How NetLab uses your data
          </a>
        </div>
        <AccountPanel me={me} onProgress={onProgress} />
      </section>
    </div>
  );
}
