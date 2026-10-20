import { getLab, levelFor, xpAward } from '@netlab/labs';
import { evaluateAll, Network, type LogEntry } from '@netlab/sim';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type Me, type SubmitResult } from '../api.ts';
import { Briefing, Inline } from '../components/Briefing.tsx';
import { DeviceTerminal } from '../components/DeviceTerminal.tsx';
import { Topology } from '../components/Topology.tsx';

const MAX_LOG = 5000;

export function LabPage({ labId, me, onProgress }: { labId: string; me: Me; onProgress: () => Promise<void> }) {
  const lab = getLab(labId);
  const netRef = useRef<Network | null>(null);
  const logRef = useRef<LogEntry[]>([]);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [ready, setReady] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const [active, setActive] = useState(lab?.topology.devices[0]?.id ?? '');
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
    addEventListener('pagehide', onHide);
    return () => {
      removeEventListener('pagehide', onHide);
      flush(true);
    };
  }, [lab, flush]);

  if (!lab) {
    return (
      <div className="page">
        <p>That lab doesn't exist.</p>
        <a href="#/">Back to labs</a>
      </div>
    );
  }

  const net = netRef.current;
  const checks = lab.objectives.map((o) => o.check);
  const live = net ? evaluateAll(net, checks) : [];
  const doneCount = live.filter(Boolean).length;
  const alreadyDone = completed || me.completions.some((c) => c.labId === lab.id);

  const onLine = (device: string) => (line: string) => {
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
    <div className="page lab-page">
      <div className="lab-head">
        <a href="#/" className="muted">
          ← All labs
        </a>
        <h1>{lab.title}</h1>
        <div className="tags">
          <span className={`tag ${lab.difficulty.toLowerCase()}`}>{lab.difficulty}</span>
          <span className="tag">CCNA: {lab.ccnaDomain}</span>
          <span className={alreadyDone ? 'ok' : 'xp'}>
            {alreadyDone ? '✓ Completed' : `${xpAward(lab.xp, hintsUsed)} XP available`}
          </span>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {!ready && !error && <p className="muted">Loading lab…</p>}
      {ready && net && (
        <div className="lab-layout">
          <aside className="lab-side">
            <section className="card">
              <h2>Your task</h2>
              <Briefing text={lab.briefing} />
            </section>
            <section className="card">
              <h2>
                Objectives{' '}
                <span className="muted small">
                  {doneCount}/{lab.objectives.length}
                </span>
              </h2>
              <ul className="objectives">
                {lab.objectives.map((o, i) => (
                  <li key={i} className={live[i] ? 'met' : undefined}>
                    <span className="check" aria-hidden="true">
                      {live[i] ? '✓' : ''}
                    </span>
                    <span>{o.label}</span>
                    <span className="sr-only">{live[i] ? '(done)' : '(not done)'}</span>
                  </li>
                ))}
              </ul>
              <div className="actions">
                <button className="btn primary" onClick={() => void submit()} disabled={busy}>
                  {busy ? 'Checking…' : 'Submit lab'}
                </button>
                <button className="btn ghost" onClick={reset}>
                  Reset lab
                </button>
              </div>
              {result && (
                <div className={`result ${result.passed ? 'pass' : 'fail'}`} role="status">
                  {result.passed && result.xpAwarded > 0 && (
                    <>
                      <strong>Lab complete! +{result.xpAwarded} XP</strong>
                      {result.level.level > before.level && (
                        <div>
                          Level up! You're now level {result.level.level}: {result.level.rank}.
                        </div>
                      )}
                    </>
                  )}
                  {result.passed && result.xpAwarded === 0 && <strong>All objectives met. You already earned XP for this lab.</strong>}
                  {!result.passed && (
                    <strong>
                      {result.results.filter(Boolean).length} of {result.results.length} objectives met. Keep going!
                    </strong>
                  )}
                </div>
              )}
            </section>
            <section className="card">
              <h2>Hints</h2>
              {hintsUsed === 0 && <p className="muted small">Stuck? Each hint costs 10% of this lab's XP.</p>}
              <ol className="hints">
                {lab.hints.slice(0, hintsUsed).map((h, i) => (
                  <li key={i}>
                    <Inline text={h} />
                  </li>
                ))}
              </ol>
              {hintsUsed < lab.hints.length && (
                <button className="btn ghost small" onClick={() => void hint()}>
                  Show hint {hintsUsed + 1} {alreadyDone ? '' : '(−10% XP)'}
                </button>
              )}
            </section>
          </aside>
          <section className="lab-main">
            <div className="card topo-card">
              <Topology net={net} active={active} onSelect={setActive} />
            </div>
            <div className="card console-card">
              <div className="device-tabs" role="tablist" aria-label="Device consoles">
                {lab.topology.devices.map((d) => (
                  <button
                    key={d.id}
                    role="tab"
                    aria-selected={active === d.id}
                    onClick={() => setActive(d.id)}
                  >
                    {net.device(d.id).running.hostname}
                  </button>
                ))}
                <span className="muted small tip">? for help · Tab completes · ↑ history</span>
              </div>
              {lab.topology.devices.map((d) => (
                <DeviceTerminal
                  key={`${epoch}-${d.id}`}
                  net={net}
                  deviceId={d.id}
                  active={active === d.id}
                  intro={
                    (d.kind === 'pc' ? 'NetLab PC Command Line 1.0\nType help for commands.\n' : '') +
                    (restored ? `% Restored your earlier session (${restored} commands).\n` : '')
                  }
                  onLine={onLine(d.id)}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
