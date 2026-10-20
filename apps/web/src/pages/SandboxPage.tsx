import { LIMITS, MODELS, Network, type DeviceKind, type DeviceModel } from '@netlab/sim';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.ts';
import { DeviceGlyph } from '../components/DeviceIcon.tsx';
import { Stage } from '../components/Stage.tsx';
import { DND_TYPE, type Positions } from '../components/TopologyCanvas.tsx';

const GROUPS: { title: string; kinds: DeviceKind[] }[] = [
  { title: 'Routers', kinds: ['router'] },
  { title: 'Switching', kinds: ['switch', 'hub'] },
  { title: 'End devices', kinds: ['pc', 'laptop', 'server', 'printer'] },
];

const empty = () => new Network({ devices: [], links: [] });

/** Free-play: build any topology, configure it, test it. Saved to the student's account. */
export function SandboxPage() {
  const netRef = useRef<Network | null>(null);
  const [, setTick] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [status, setStatus] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading');
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirty = useRef(false);

  const save = useCallback((keepalive = false) => {
    clearTimeout(timer.current);
    if (!dirty.current || !netRef.current) return;
    dirty.current = false;
    setStatus('saving');
    api.saveSandbox(netRef.current.snapshot(), keepalive).then(
      () => setStatus('saved'),
      () => {
        dirty.current = true;
        setStatus('error');
      },
    );
  }, []);

  const changed = useCallback(() => {
    dirty.current = true;
    setTick((t) => t + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(), 1200);
  }, [save]);

  useEffect(() => {
    // A superseded load (e.g. a remount) must not overwrite edits made since.
    let stale = false;
    api.sandbox().then(
      ({ snapshot }) => {
        if (stale) return;
        try {
          netRef.current = snapshot ? Network.fromSnapshot(snapshot) : empty();
        } catch {
          netRef.current = empty();
        }
        setStatus('saved');
      },
      () => {
        if (stale) return;
        netRef.current = empty();
        setStatus('error');
      },
    );
    const onHide = () => save(true);
    addEventListener('pagehide', onHide);
    return () => {
      stale = true;
      removeEventListener('pagehide', onHide);
      save(true);
    };
  }, [save]);

  const net = netRef.current;
  if (!net) return <div className="center muted">Loading your sandbox…</div>;

  const positions: Positions = Object.fromEntries(net.topology.devices.map((d) => [d.id, { x: d.x, y: d.y }]));

  const add = (kind: DeviceKind, model?: string, x?: number, y?: number): string | null => {
    try {
      const n = net.topology.devices.length;
      // Staggered grid, so cables between neighbours don't run behind other devices.
      const col = n % 4;
      const row = Math.floor(n / 4);
      net.addDevice(kind, x ?? 20 + col * 20, y ?? 20 + row * 25 + (col % 2) * 10, model);
      setError('');
      changed();
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not add the device.';
      setError(msg);
      return msg;
    }
  };

  const clear = () => {
    if (!confirm('Delete every device and cable in your sandbox?')) return;
    netRef.current = empty();
    setEpoch((e) => e + 1);
    changed();
  };

  const item = (m: DeviceModel) => (
    <button
      key={m.model}
      className="palette-item"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_TYPE, `${m.kind}:${m.model}`);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => add(m.kind, m.model)}
      title={`${m.label}: ${m.description}. Click to add, or drag onto the canvas.`}
    >
      <DeviceGlyph kind={m.kind} size={40} />
      <span className="palette-text">
        <span className="palette-name">{m.label}</span>
        <span className="palette-desc">{m.description}</span>
      </span>
    </button>
  );

  return (
    <div className="ws">
      <header className="ws-header">
        <div className="ws-title">
          <h1>Sandbox</h1>
          <span className="meta mono">
            {net.topology.devices.length}/{LIMITS.devices} devices · {net.topology.links.length}/{LIMITS.links} cables
          </span>
        </div>
        <span className={`save-state ${status}`} role="status">
          <span className="led" aria-hidden="true" />
          {status === 'saving' ? 'Saving' : status === 'error' ? 'Not saved, retrying' : status === 'saved' ? 'Saved' : ''}
        </span>
        <button className="btn ghost small" onClick={clear}>
          <Trash2 size={15} /> <span className="hide-sm">Clear all</span>
        </button>
      </header>

      <div className="ws-body">
        <aside className="ws-panel">
          <div className="panel-body">
            {error && <p className="error">{error}</p>}
            {GROUPS.map((g) => (
              <section key={g.title} className="palette-group">
                <h2 className="label-caps">{g.title}</h2>
                <div className="palette">{MODELS.filter((m) => g.kinds.includes(m.kind)).map(item)}</div>
              </section>
            ))}

            <div className="note">
              <h2 className="label-caps">How to build</h2>
              <ol>
                <li>Click a device, or drag it onto the canvas.</li>
                <li>
                  Press <b>Connect</b>, click two devices, and pick a port on each.
                </li>
                <li>Double-click a router or switch for its console, or a PC for its desktop.</li>
                <li>Select a device or cable and press Delete to remove it.</li>
              </ol>
              <p className="muted small">Saved to your account automatically.</p>
            </div>
          </div>
        </aside>

        <Stage
          key={epoch}
          net={net}
          epoch={epoch}
          onLine={(device, line) => {
            const out = net.exec(device, line);
            changed();
            return out;
          }}
          onMutate={changed}
          positions={positions}
          onMove={(id, x, y) => {
            net.moveDevice(id, x, y);
            changed();
          }}
          sandbox={{
            onDrop: (kind, x, y, model) => add(kind, model, x, y),
            onConnect: (a, b) => {
              const err = net.connect(a, b);
              if (!err) changed();
              return err;
            },
            onDeleteDevice: (id) => {
              net.removeDevice(id);
              changed();
            },
            onDeleteLink: (i) => {
              const l = net.topology.links[i];
              if (l) net.disconnect(l.a.device, l.a.port);
              changed();
            },
          }}
        />
      </div>
    </div>
  );
}
