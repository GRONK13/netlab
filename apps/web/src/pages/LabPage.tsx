import { getLab, levelFor, xpAward, type Lab } from '@netlab/labs';
import { evaluateAll, Network, type LogEntry } from '@netlab/sim';
import { ArrowLeft, Check, CircleCheck, Lightbulb, ListChecks, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type Me, type SubmitResult } from '../api.ts';
import { Briefing, Inline } from '../components/Briefing.tsx';
import { Stage } from '../components/Stage.tsx';
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

  const [ready, setReady] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const [positions, setPositions] = useState<Positions>(() => (lab ? loadPositions(lab) : {}));
  const [tab, setTab] = useState<Tab>('task');
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
    api.attempt(lab.id).then(
      (a) => {
        logRef.current = a.log;
        netRef.current = Network.replay(lab.topology, a.log);
        setHintsUsed(a.hintsUsed);
        setCompleted(a.completed);
        setRestored(a.log.length);
        setReady(true);
      },
      (e) => setError(e instanceof ApiError ? e.message : "Couldn't load your progress."),
    );
    const onHide = () => flush(true);
    // Browsers reserve Ctrl+W for closing the tab; ask before leaving mid-lab.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (logRef.current.length > 0) e.preventDefault();
    };
    addEventListener('pagehide', onHide);
    addEventListener('beforeunload', onBeforeUnload);
    return () => {
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
  const doneCount = live.filter(Boolean).length;
  const alreadyDone = completed || me.completions.some((c) => c.labId === lab.id);
  const pct = lab.objectives.length ? (doneCount / lab.objectives.length) * 100 : 0;

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

  return (
    <div className="ws">
      <header className="ws-header">
        <a href="#/" className="icon-btn" aria-label="All labs" title="All labs">
          <ArrowLeft size={18} />
        </a>
        <div className="ws-title">
          <h1>{lab.title}</h1>
          <div className="chips">
            <span className={`chip ${lab.difficulty.toLowerCase()}`}>{lab.difficulty}</span>
            <span className="chip">{lab.ccnaDomain}</span>
            {alreadyDone ? (
              <span className="chip success">
                <Check size={13} /> Completed
              </span>
            ) : (
              <span className="chip xp">
                <Sparkles size={13} /> {xpAward(lab.xp, hintsUsed)} XP
              </span>
            )}
          </div>
        </div>
        <div className="ws-progress" title={`${doneCount} of ${lab.objectives.length} objectives`}>
          <div className="bar">
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="small muted">
            {doneCount}/{lab.objectives.length}
          </span>
        </div>
        <button className="btn ghost" onClick={reset} disabled={!ready}>
          <RotateCcw size={16} /> <span className="hide-sm">Reset</span>
        </button>
        <button className="btn primary" onClick={() => void submit()} disabled={busy || !ready}>
          <Send size={16} /> {busy ? 'Checking…' : 'Submit'}
        </button>
      </header>

      <div className="ws-body">
        <aside className="ws-panel">
          <div className="seg" role="tablist" aria-label="Lab panel">
            <button role="tab" aria-selected={tab === 'task'} onClick={() => setTab('task')}>
              Task
            </button>
            <button role="tab" aria-selected={tab === 'objectives'} onClick={() => setTab('objectives')}>
              Objectives <span className="count">{doneCount}/{lab.objectives.length}</span>
            </button>
            <button role="tab" aria-selected={tab === 'hints'} onClick={() => setTab('hints')}>
              Hints {hintsUsed > 0 && <span className="count">{hintsUsed}</span>}
            </button>
          </div>

          <div className="panel-body">
            {error && <p className="error">{error}</p>}
            {result && (
              <div className={`result ${result.passed ? 'pass' : 'fail'}`} role="status">
                {result.passed ? <CircleCheck size={20} /> : <ListChecks size={20} />}
                <div>
                  {result.passed && result.xpAwarded > 0 && (
                    <>
                      <strong>Lab complete! +{result.xpAwarded} XP</strong>
                      {result.level.level > before.level && (
                        <div>
                          Level up: you're now level {result.level.level}, {result.level.rank}.
                        </div>
                      )}
                    </>
                  )}
                  {result.passed && result.xpAwarded === 0 && <strong>All objectives met. You already earned XP here.</strong>}
                  {!result.passed && (
                    <strong>
                      {result.results.filter(Boolean).length} of {result.results.length} objectives met. Keep going!
                    </strong>
                  )}
                </div>
                <button className="icon-btn" onClick={() => setResult(null)} aria-label="Dismiss">
                  <X size={16} />
                </button>
              </div>
            )}

            {tab === 'task' && (
              <>
                <Briefing text={lab.briefing} />
                <div className="tip-box">
                  <strong>How to work</strong>
                  <ul>
                    <li>Double-click a switch or router to open its console below.</li>
                    <li>Double-click a PC to open its desktop.</li>
                    <li>Click any device to inspect its ports. Drag to rearrange.</li>
                  </ul>
                </div>
              </>
            )}

            {tab === 'objectives' && (
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
          />
        ) : (
          <div className="stage center muted">{error ? '' : 'Loading lab…'}</div>
        )}
      </div>
    </div>
  );
}
