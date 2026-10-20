import { LIMITS, Network, type DeviceKind } from '@netlab/sim';
import { CloudCheck, CloudUpload, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.ts';
import { DeviceGlyph, KIND_LABEL, MODEL_LABEL } from '../components/DeviceIcon.tsx';
import { Stage } from '../components/Stage.tsx';
import { DND_TYPE, type Positions } from '../components/TopologyCanvas.tsx';

const PALETTE: { kind: DeviceKind; blurb: string }[] = [
  { kind: 'router', blurb: '3 Gigabit ports' },
  { kind: 'switch', blurb: '24 Fast + 2 Gigabit ports' },
  { kind: 'pc', blurb: 'Desktop with IP config and Command Prompt' },
];

const empty = () => new Network({ devices: [], links: [] });

/** Free-play: build any topology, configure it, test it. Saved to the student's account. */
export function SandboxPage() {
  const netRef = useRef<Network | null>(null);
  const [, setTick] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [status, setStatus] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading');
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
    api.sandbox().then(
      ({ snapshot }) => {
        try {
          netRef.current = snapshot ? Network.fromSnapshot(snapshot) : empty();
        } catch {
          netRef.current = empty();
        }
        setStatus('saved');
      },
      () => {
        netRef.current = empty();
        setStatus('error');
      },
    );
    const onHide = () => save(true);
    addEventListener('pagehide', onHide);
    return () => {
      removeEventListener('pagehide', onHide);
      save(true);
    };
  }, [save]);

  const net = netRef.current;
  if (!net) return <div className="center muted">Loading your sandbox…</div>;

  const positions: Positions = Object.fromEntries(net.topology.devices.map((d) => [d.id, { x: d.x, y: d.y }]));

  const add = (kind: DeviceKind, x?: number, y?: number): string | null => {
    try {
      const n = net.topology.devices.length;
      // Staggered grid, so cables between neighbours don't run behind other devices.
      const col = n % 4;
      const row = Math.floor(n / 4);
      net.addDevice(kind, x ?? 20 + col * 20, y ?? 20 + row * 25 + (col % 2) * 10);
      changed();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not add the device.';
    }
  };

  const clear = () => {
    if (!confirm('Delete every device and cable in your sandbox?')) return;
    netRef.current = empty();
    setEpoch((e) => e + 1);
    changed();
  };

  return (
    <div className="ws">
      <header className="ws-header">
        <div className="ws-title">
          <h1>Sandbox</h1>
          <div className="chips">
            <span className="chip">
              {net.topology.devices.length}/{LIMITS.devices} devices
            </span>
            <span className="chip">
              {net.topology.links.length}/{LIMITS.links} cables
            </span>
          </div>
        </div>
        <span className={`save-state small ${status}`} role="status">
          {status === 'saving' ? <CloudUpload size={15} /> : <CloudCheck size={15} />}
          {status === 'saving' ? 'Saving…' : status === 'error' ? 'Not saved, retrying' : status === 'saved' ? 'Saved' : ''}
        </span>
        <button className="btn ghost" onClick={clear}>
          <Trash2 size={16} /> <span className="hide-sm">Clear all</span>
        </button>
      </header>

      <div className="ws-body">
        <aside className="ws-panel">
          <div className="panel-body">
            <h2 className="panel-title">Devices</h2>
            <p className="muted small">Drag onto the canvas, or click to add.</p>
            <div className="palette">
              {PALETTE.map(({ kind, blurb }) => (
                <button
                  key={kind}
                  className="palette-item"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DND_TYPE, kind);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => add(kind)}
                >
                  <DeviceGlyph kind={kind} size={44} />
                  <span>
                    <strong>
                      {KIND_LABEL[kind]} <span className="muted small">{MODEL_LABEL[kind]}</span>
                    </strong>
                    <span className="muted small">{blurb}</span>
                  </span>
                  <Plus size={16} className="palette-add" />
                </button>
              ))}
            </div>

            <div className="tip-box">
              <strong>How to build</strong>
              <ol>
                <li>Add devices from the list above.</li>
                <li>
                  Click <b>Connect</b> on the canvas, then click two devices and pick a port on each.
                </li>
                <li>Double-click a switch or router for its console, or a PC for its desktop.</li>
                <li>Select a device or cable and press Delete to remove it.</li>
              </ol>
              <p className="muted small">Everything saves to your account automatically.</p>
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
          positions={positions}
          onMove={(id, x, y) => {
            net.moveDevice(id, x, y);
            changed();
          }}
          sandbox={{
            onDrop: (kind, x, y) => add(kind, x, y),
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
