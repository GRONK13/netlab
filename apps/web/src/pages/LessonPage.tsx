import { getModule } from '@netlab/modules';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { api, type Me } from '../api.ts';
import { Markdown } from '../components/Markdown.tsx';
import { stepsFor } from '../moduleSteps.ts';

export function LessonPage({
  moduleId,
  me,
  onProgress,
}: {
  moduleId: string;
  me: Me;
  onProgress: () => Promise<void>;
}) {
  const mod = getModule(moduleId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!mod) {
    return (
      <div className="page">
        <p>That module doesn't exist.</p>
        <a href="#/">Back home</a>
      </div>
    );
  }
  const steps = stepsFor(mod, me);
  const read = steps.find((s) => s.key === 'lesson')?.done ?? false;
  const after = steps[steps.findIndex((s) => s.key === 'lesson') + 1];

  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      await api.lessonDone(mod.id);
      await onProgress();
    } catch {
      setError("Couldn't save your progress. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  // Hash routing owns location.hash, so the contents scroll instead of linking to #anchors.
  const jump = (id: string) =>
    document.getElementById(`lesson-${id}`)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="page lesson-page">
      <header className="page-head">
        <a href={`#/learn/${mod.id}`} className="back-link small">
          <ArrowLeft size={14} /> Module {mod.number}: {mod.title}
        </a>
        <h1>Lesson: {mod.title}</h1>
      </header>

      <div className="lesson">
        <nav className="lesson-toc" aria-label="Lesson sections">
          <span className="label-caps">Contents</span>
          <ol>
            {mod.lesson.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => jump(s.id)}>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <article className="lesson-body">
          {mod.lesson.map((s, i) => (
            <section key={s.id} id={`lesson-${s.id}`} className="lesson-section">
              <h2>
                <span className="mono muted">{String(i + 1).padStart(2, '0')}</span> {s.title}
              </h2>
              <Markdown text={s.body} />
            </section>
          ))}

          <section className="lesson-end panel">
            {error && <p className="error">{error}</p>}
            {read ? (
              <p className="done-mark">
                <Check size={15} strokeWidth={3} /> You've finished this lesson.
              </p>
            ) : (
              <>
                <p>That's the whole lesson. Mark it finished to tick it off in the module.</p>
                <div>
                  <button className="btn accent" onClick={() => void finish()} disabled={busy}>
                    <Check size={16} /> {busy ? 'Saving…' : 'Finish lesson'}
                  </button>
                </div>
              </>
            )}
            {after && (
              <a className="btn" href={after.href}>
                Next: {after.title} <ArrowRight size={16} />
              </a>
            )}
          </section>
        </article>
      </div>
    </div>
  );
}
