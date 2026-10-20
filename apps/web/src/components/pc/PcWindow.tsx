import { type Network } from '@netlab/sim';
import { Globe, Maximize2, Minimize2, Minus, Network as NetIcon, Power, Server, SquareTerminal, Unplug, X } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType, type PointerEvent as RPointerEvent } from 'react';
import { DeviceGlyph } from '../DeviceIcon.tsx';
import { CommandPrompt, IpConfiguration, WebBrowser, WebServer, type AppProps } from './apps.tsx';

interface Props {
  net: Network;
  id: string;
  onLine: (line: string) => string;
  onMutate: () => void;
  onClose: () => void;
}

type AppId = 'cmd' | 'ipconfig' | 'browser' | 'webserver';

interface AppDef {
  title: string;
  Icon: ComponentType<{ size?: number }>;
  tile: string;
  Component: ComponentType<AppProps>;
  /** Default window size, percent of the screen. */
  w: number;
  h: number;
}

const APPS: Record<AppId, AppDef> = {
  ipconfig: { title: 'IP Configuration', Icon: NetIcon, tile: 'tile-net', Component: IpConfiguration, w: 56, h: 82 },
  cmd: { title: 'Command Prompt', Icon: SquareTerminal, tile: 'tile-cmd', Component: CommandPrompt, w: 74, h: 72 },
  browser: { title: 'Web Browser', Icon: Globe, tile: 'tile-web', Component: WebBrowser, w: 72, h: 78 },
  webserver: { title: 'Web Server', Icon: Server, tile: 'tile-srv', Component: WebServer, w: 58, h: 86 },
};

interface Win {
  app: AppId;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  min: boolean;
  max: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** A simulated computer: monitor, desktop, windows and taskbar. Printers get a config panel instead. */
export function PcWindow({ net, id, onLine, onMutate, onClose }: Props) {
  const dev = net.device(id);
  const [pos, setPos] = useState({ x: 24, y: 16 });
  const drag = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null);

  const startDrag = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const moveDrag = (e: RPointerEvent) => {
    const d = drag.current;
    if (d) setPos({ x: Math.max(0, d.x + e.clientX - d.sx), y: Math.max(0, d.y + e.clientY - d.sy) });
  };

  return (
    <div className={`pc-window ${dev.kind}`} style={{ left: pos.x, top: pos.y }} role="dialog" aria-label={`${dev.running.hostname}`}>
      <div className="pc-titlebar" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => (drag.current = null)}>
        <DeviceGlyph kind={dev.kind} size={26} />
        <strong>{dev.running.hostname}</strong>
        <span className="mono muted small">{dev.model}</span>
        <button className="icon-btn" onClick={onClose} aria-label={`Close ${dev.running.hostname}`}>
          <X size={16} />
        </button>
      </div>
      {dev.kind === 'printer' ? (
        <div className="printer-panel">
          <IpConfiguration net={net} id={id} active onLine={onLine} onMutate={onMutate} />
        </div>
      ) : (
        <Monitor net={net} id={id} onLine={onLine} onMutate={onMutate} onClose={onClose} />
      )}
    </div>
  );
}

function Monitor({ net, id, onLine, onMutate, onClose }: Props) {
  const dev = net.device(id);
  const screen = useRef<HTMLDivElement>(null);
  const [wins, setWins] = useState<Win[]>([]);
  const [selectedIcon, setSelectedIcon] = useState<AppId | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const zTop = useRef(1);
  const clock = useClock();

  const apps: AppId[] = dev.kind === 'server' ? ['cmd', 'ipconfig', 'browser', 'webserver'] : ['cmd', 'ipconfig', 'browser'];
  const top = wins.filter((w) => !w.min).sort((a, b) => b.z - a.z)[0]?.app;

  const focus = (app: AppId) => setWins((ws) => ws.map((w) => (w.app === app ? { ...w, z: ++zTop.current, min: false } : w)));

  const open = (app: AppId) => {
    setStartOpen(false);
    setWins((ws) => {
      if (ws.some((w) => w.app === app)) return ws.map((w) => (w.app === app ? { ...w, z: ++zTop.current, min: false } : w));
      const def = APPS[app];
      const n = ws.length;
      // Cascade to the right of the desktop icons.
      const x = Math.min(16 + n * 4, 100 - def.w);
      const y = Math.min(4 + n * 4, 100 - def.h);
      return [...ws, { app, w: def.w, h: def.h, x, y, z: ++zTop.current, min: false, max: false }];
    });
  };

  const update = (app: AppId, patch: Partial<Win>) => setWins((ws) => ws.map((w) => (w.app === app ? { ...w, ...patch } : w)));
  const close = (app: AppId) => setWins((ws) => ws.filter((w) => w.app !== app));

  const startMove = (e: RPointerEvent, win: Win) => {
    if ((e.target as HTMLElement).closest('button') || win.max) return;
    focus(win.app);
    const rect = screen.current!.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - sx) / rect.width) * 100;
      const dy = ((ev.clientY - sy) / rect.height) * 100;
      update(win.app, { x: clamp(win.x + dx, -win.w + 10, 95), y: clamp(win.y + dy, 0, 92) });
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  };

  const pc = dev.running.pc;
  const linked = net.linkUp(id, 'FastEthernet0');
  const netStatus = !linked ? 'Network cable unplugged' : pc?.ip ? `Connected · ${pc.ip}` : 'Connected · no IP address';

  return (
    <div className="monitor">
      <div className="screen" ref={screen}>
        <div
          className="wallpaper"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedIcon(null);
              setStartOpen(false);
            }
          }}
        >
          <div className="desk-icons">
            {apps.map((a) => {
              const { Icon, title, tile } = APPS[a];
              return (
                <button
                  key={a}
                  className={`desk-icon${selectedIcon === a ? ' selected' : ''}`}
                  onClick={() => setSelectedIcon(a)}
                  onDoubleClick={() => open(a)}
                  onKeyDown={(e) => e.key === 'Enter' && open(a)}
                  title="Double-click to open"
                >
                  <span className={`tile ${tile}`}>
                    <Icon size={22} />
                  </span>
                  <span className="desk-label">{title}</span>
                </button>
              );
            })}
          </div>
          <div className="wallpaper-mark" aria-hidden="true">
            {dev.running.hostname}
          </div>

          {wins.map((w) => {
            const def = APPS[w.app];
            const style = w.max
              ? { left: 0, top: 0, width: '100%', height: '100%', zIndex: w.z }
              : { left: `${w.x}%`, top: `${w.y}%`, width: `${w.w}%`, height: `${w.h}%`, zIndex: w.z };
            return (
              <section
                key={w.app}
                className={`os-window${top === w.app ? ' focused' : ''}`}
                style={style}
                hidden={w.min}
                onPointerDown={() => top !== w.app && focus(w.app)}
                aria-label={def.title}
              >
                <header className="os-titlebar" onPointerDown={(e) => startMove(e, w)} onDoubleClick={() => update(w.app, { max: !w.max })}>
                  <def.Icon size={14} />
                  <span>{def.title}</span>
                  <button aria-label="Minimize" onClick={() => update(w.app, { min: true })}>
                    <Minus size={13} />
                  </button>
                  <button aria-label={w.max ? 'Restore' : 'Maximize'} onClick={() => update(w.app, { max: !w.max })}>
                    {w.max ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  </button>
                  <button aria-label="Close" className="close" onClick={() => close(w.app)}>
                    <X size={13} />
                  </button>
                </header>
                <div className="os-body">
                  <def.Component net={net} id={id} active={top === w.app} onLine={onLine} onMutate={onMutate} />
                </div>
              </section>
            );
          })}

          {startOpen && (
            <div className="start-menu" role="menu">
              <div className="start-user">
                <DeviceGlyph kind={dev.kind} size={30} />
                <div>
                  <strong>{dev.running.hostname}</strong>
                  <div className="small">{pc?.ip ?? 'No IP address'}</div>
                </div>
              </div>
              {apps.map((a) => {
                const { Icon, title } = APPS[a];
                return (
                  <button key={a} role="menuitem" onClick={() => open(a)}>
                    <Icon size={16} /> {title}
                  </button>
                );
              })}
              <hr />
              <button role="menuitem" onClick={onClose}>
                <Power size={16} /> Shut down
              </button>
            </div>
          )}
        </div>

        <footer className="taskbar">
          <button className={`start${startOpen ? ' on' : ''}`} onClick={() => setStartOpen((s) => !s)} aria-label="Start">
            <span aria-hidden="true">&gt;_</span>
          </button>
          <div className="task-items">
            {wins.map((w) => {
              const { Icon, title } = APPS[w.app];
              const isTop = top === w.app;
              return (
                <button
                  key={w.app}
                  className={`task${isTop ? ' active' : ''}`}
                  onClick={() => (isTop ? update(w.app, { min: true }) : focus(w.app))}
                >
                  <Icon size={14} /> <span>{title}</span>
                </button>
              );
            })}
          </div>
          <div className="tray" title={netStatus}>
            {linked ? <NetIcon size={14} /> : <Unplug size={14} className="tray-bad" />}
            <span className="clock">{clock}</span>
          </div>
        </footer>
      </div>
      {dev.kind === 'laptop' ? <div className="laptop-deck" aria-hidden="true" /> : <div className="stand" aria-hidden="true" />}
    </div>
  );
}
