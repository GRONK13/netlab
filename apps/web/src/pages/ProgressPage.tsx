import { GOAL_MAX, GOAL_MIN } from '@netlab/modules';
import { useState } from 'react';
import { api, type Me } from '../api.ts';
import { WeekStrip } from '../components/WeekStrip.tsx';
import { days, dayWord } from '../format.ts';

const GOALS = Array.from({ length: GOAL_MAX - GOAL_MIN + 1 }, (_, i) => GOAL_MIN + i);

export function ProgressPage({ me, onProgress }: { me: Me; onProgress: () => Promise<void> }) {
  const { today, streak, week } = me.progress;
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
    </div>
  );
}
