import { getLab, LABS, levelFor, xpAward, type Lab } from '@netlab/labs';
import { MODULES } from '@netlab/modules';
import { evaluateAll, Network, type LogEntry } from '@netlab/sim';
import { ArrowLeft, Check, Lightbulb, RotateCcw, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type Me, type SubmitResult } from '../api.ts';
import { Briefing, Inline } from '../components/Briefing.tsx';
import { LedMeter } from '../components/LevelCard.tsx';
import { Stage } from '../components/Stage.tsx';
import { SubmitDialog, type NextStep } from '../components/SubmitDialog.tsx';
import type { Positions } from '../components/TopologyCanvas.tsx';

const MAX_LOG = 5000;

function specPositions(lab: Lab): Positions {
  return Object.fromEntries(lab.topology.devices.map((d) => [d.id, { x: d.x, y: d.y }]));
}

function loadPositions(lab: Lab): Positions {
  const base = specPositions(lab);
  try {
    const saved = JSON.parse(localStorage.getItem(`netlab:layout:${lab.id}`) ?? '{}') as Positions;
    for (const id of Object.keys(base)) if (saved[id]) base[id] = saved[id];
  } catch {
    // Layout is cosmetic; fall back to the lab's default.
  }
  return base;
}

type Tab = 'task' | 'objectives' | 'hints';

export function LabPage({ labId, me, onProgress }: { labId: string; me: Me; onProgress: () => Promise<void> }) {
  const lab = getLab(labId);
  const netRef = useRef<Network | null>(null);
  const logRef = useRef<LogEntry[]>([]);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const submitButton = useRef<HTMLButtonElement>(null);

  const [ready, setReady] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const [positions, setPositions] = useState<Positions>(() => (lab ? loadPositions(lab) : {}));
  // Guided practice opens on its steps; graded labs on the task.
  const [tab, setTab] = useState<Tab>(lab?.guided ? 'objectives' : 'task');
  const [hintsUsed, setHintsUsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [restored, setRestored] = useState(0);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const flush = useCallback(
    (keepalive = false) => {
      clearTimeout(saveTimer.current);
      if (!dirty.current || !lab) return;
      dirty.current = false;
      api.saveAttempt(lab.id, logRef.current, keepalive).catch(() => {
        dirty.current = true;
      });
    },
    [lab],
  );

  useEffect(() => {
    if (!lab) return;
    // A superseded load (e.g. a remount) must not overwrite commands typed since.
    let stale = false;
    api.attempt(lab.id).then(
      (a) => {
        if (stale) return;
        logRef.current = a.log;
        netRef.current = Network.replay(lab.topology, a.log);
        setHintsUsed(a.hintsUsed);
        setCompleted(a.completed);
        setRestored(a.log.length);
        setReady(true);
      },
      (e) => !stale && setError(e instanceof ApiError ? e.message : "Couldn't load your progress."),
    );
    const onHide = () => flush(true);
    // Browsers reserve Ctrl+W for closing the tab; ask before leaving mid-lab.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (logRef.current.length > 0) e.preventDefault();
    };
    addEventListener('pagehide', onHide);
    addEventListener('beforeunload', onBeforeUnload);
    return () => {
      stale = true;
      removeEventListener('pagehide', onHide);
      removeEventListener('beforeunload', onBeforeUnload);
      flush(true);
    };
  }, [lab, flush]);

  // Remember the student's layout for this lab (cosmetic; never graded).
  useEffect(() => {
    if (!lab) return;
    try {
      localStorage.setItem(`netlab:layout:${lab.id}`, JSON.stringify(positions));
    } catch {
      // Private mode: the layout just won't be remembered.
    }
  }, [lab, positions]);

  if (!lab) {
    return (
      <div className="page">
        <p>That lab doesn't exist.</p>
        <a href="#/">Back to labs</a>
      </div>
    );
  }

  const net = netRef.current;
  const live = net ? evaluateAll(net, lab.objectives.map((o) => o.check)) : [];
  const firstOpen = live.findIndex((met) => !met);
  const inOrder = firstOpen === -1 ? lab.objectives.length : firstOpen;
  // Guided labs count steps finished in order, so a later step that happens to be true early
  // (say, a ping that works before any VLANs exist) doesn't inflate the progress.
  const doneCount = !net ? 0 : lab.guided ? inOrder : live.filter(Boolean).length;
  // Nothing to show until the network has loaded and been checked.
  const shownSteps = !net ? 0 : firstOpen === -1 ? lab.objectives.length : firstOpen + 1;
  const alreadyDone = completed || me.completions.some((c) => c.labId === lab.id);

  const onLine = (device: string, line: string) => {
    if (!netRef.current) return '';
    if (logRef.current.length >= MAX_LOG) return '% Command limit reached for this attempt. Reset the lab to start over.';
    const out = netRef.current.exec(device, line);
    logRef.current.push({ device, line });
    dirty.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flush(), 1500);
    setTick((t) => t + 1);
    return out;
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api.submit(lab.id, logRef.current);
      dirty.current = false;
      setResult(r);
      if (r.passed) {
        setCompleted(true);
        await onProgress();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Submitting failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const hint = async () => {
    try {
      setHintsUsed((await api.hint(lab.id)).hintsUsed);
    } catch {
      setError("Couldn't load a hint.");
    }
  };

  const reset = () => {
    if (!confirm('Reset every device in this lab to its starting state? Your commands will be cleared.')) return;
    logRef.current = [];
    netRef.current = new Network(lab.topology);
    dirty.current = true;
    flush();
    setRestored(0);
    setResult(null);
    setEpoch((e) => e + 1);
  };

  const before = levelFor(Math.max(0, (result?.level.xp ?? 0) - (result?.xpAwarded ?? 0)));
  const allMet = doneCount === lab.objectives.length;
  // After a pass: back to the module this lab belongs to, else the next unfinished lab.
  const mod = MODULES.find((m) => m.practice === lab.id || m.challenge === lab.id);
  const nextLab = LABS.find((l) => l.id !== lab.id && !me.completions.some((c) => c.labId === l.id));
  const next: NextStep = mod
    ? { href: `#/learn/${mod.id}`, label: `Back to Module ${mod.number}` }
    : nextLab
      ? { href: `#/lab/${nextLab.id}`, label: `Next lab: ${nextLab.title}` }
      : { href: '#/', label: 'Back to all labs' };

  return (
    <div className="ws">
      <header className="ws-header">
        <a href="#/" className="icon-btn" aria-label="All labs" title="All labs">
          <ArrowLeft size={18} />
        </a>
        <div className="ws-title">
          <h1>{lab.title}</h1>
          <span className="meta">
            <span className={`tag ${lab.difficulty.toLowerCase()}`}>{lab.difficulty}</span>
            <span className="hide-sm">{lab.ccnaDomain}</span>
            {alreadyDone ? (
              <span className="done-mark">
                <Check size={13} strokeWidth={3} /> Completed
              </span>
            ) : (
              <span className="mono xp-text">{xpAward(lab.xp, hintsUsed)} XP</span>
            )}
          </span>
        </div>
        <div className="ws-progress" title={`${doneCount} of ${lab.objectives.length} objectives met`}>
          <LedMeter lit={doneCount} total={lab.objectives.length} label="Objectives met" />
          <span className="mono small">
            {doneCount}/{lab.objectives.length}
          </span>
        </div>
        <button className="btn ghost small" onClick={reset} disabled={!ready}>
          <RotateCcw size={15} /> <span className="hide-sm">Reset</span>
        </button>
        <button
          ref={submitButton}
          className={`btn accent${allMet && !alreadyDone ? ' ready' : ''}`}
          onClick={() => void submit()}
          disabled={busy || !ready}
          title={allMet ? 'All objectives met: submit to be graded and earn XP' : 'Check your work on the server and see what is left'}
        >
          <Send size={15} /> {busy ? 'Checking…' : 'Submit'}
        </button>
      </header>

      <div className="ws-body">
        <aside className="ws-panel">
          <div className="tabs" role="tablist" aria-label="Lab panel">
            <button role="tab" aria-selected={tab === 'task'} onClick={() => setTab('task')}>
              Task
            </button>
            <button role="tab" aria-selected={tab === 'objectives'} onClick={() => setTab('objectives')}>
              {lab.guided ? 'Steps' : 'Objectives'} <span className="count mono">{doneCount}/{lab.objectives.length}</span>
            </button>
            <button role="tab" aria-selected={tab === 'hints'} onClick={() => setTab('hints')}>
              Hints {hintsUsed > 0 && <span className="count mono">{hintsUsed}</span>}
            </button>
          </div>

          <div className="panel-body">
            {error && <p className="error">{error}</p>}

            {tab === 'task' && (
              <>
                <Briefing text={lab.briefing} />
                <div className="note">
                  <h2 className="label-caps">How to work</h2>
                  <ul>
                    <li>Double-click a switch or router to open its console below.</li>
                    <li>Double-click a PC to open its desktop.</li>
                    <li>Click any device to inspect its ports. Drag to rearrange.</li>
                    <li>
                      When every objective is met, press <b>Submit</b>. The server re-checks your work and awards the
                      XP.
                    </li>
                  </ul>
                </div>
              </>
            )}

            {tab === 'objectives' && lab.guided && (
              <>
                {/* Steps up to the first unmet one are shown; the rest unlock as the student goes. */}
                <ol className="objectives steps">
                  {lab.objectives.slice(0, shownSteps).map((o, i) => (
                    <li key={i} className={live[i] ? 'met' : 'current'}>
                      <span className="check" aria-hidden="true">
                        {live[i] ? <Check size={12} strokeWidth={3} /> : <span className="mono">{i + 1}</span>}
                      </span>
                      <span className="step-text">
                        <span>{o.label}</span>
                        {live[i] && o.why && (
                          <span className="why">
                            <Inline text={o.why} />
                          </span>
                        )}
                      </span>
                      <span className="sr-only">{live[i] ? '(done)' : '(current step)'}</span>
                    </li>
                  ))}
                </ol>
                {net && shownSteps < lab.objectives.length && (
                  <p className="muted small">
                    {lab.objectives.length - shownSteps} more step{lab.objectives.length - shownSteps > 1 ? 's' : ''}{' '}
                    unlock as you go.
                  </p>
                )}
              </>
            )}

            {tab === 'objectives' && !lab.guided && (
              <ul className="objectives">
                {lab.objectives.map((o, i) => (
                  <li key={i} className={live[i] ? 'met' : undefined}>
                    <span className="check" aria-hidden="true">
                      {live[i] && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span>{o.label}</span>
                    <span className="sr-only">{live[i] ? '(done)' : '(not done)'}</span>
                  </li>
                ))}
              </ul>
            )}

            {tab === 'hints' && (
              <>
                {hintsUsed === 0 && (
                  <p className="muted">Stuck? Hints reveal one step at a time. Each costs 10% of this lab's XP.</p>
                )}
                <ol className="hints">
                  {lab.hints.slice(0, hintsUsed).map((h, i) => (
                    <li key={i}>
                      <Inline text={h} />
                    </li>
                  ))}
                </ol>
                {hintsUsed < lab.hints.length && (
                  <button className="btn" onClick={() => void hint()}>
                    <Lightbulb size={16} /> Show hint {hintsUsed + 1} {alreadyDone ? '' : '(−10% XP)'}
                  </button>
                )}
              </>
            )}
          </div>
        </aside>

        {ready && net ? (
          <Stage
            net={net}
            onLine={onLine}
            epoch={epoch}
            restored={restored}
            positions={positions}
            onMove={(id, x, y) => setPositions((p) => ({ ...p, [id]: { x, y } }))}
            onResetLayout={() => setPositions(specPositions(lab))}
            onMutate={() => setTick((t) => t + 1)}
          />
        ) : (
          <div className="stage center muted">{error ? '' : 'Loading lab…'}</div>
        )}
      </div>

      {result && (
        <SubmitDialog
          lab={lab}
          result={result}
          levelBefore={before}
          next={next}
          onClose={(keepWorking) => {
            setResult(null);
            if (keepWorking) setTab('objectives');
            // Submit was disabled while checking, so the browser dropped focus; put it back.
            submitButton.current?.focus();
          }}
        />
      )}
    </div>
  );
}
