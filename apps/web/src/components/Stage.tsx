import { physicalPorts, shortName, type DeviceKind, type LinkEnd, type Network } from '@netlab/sim';
import {
  Cable,
  ChevronDown,
  ChevronUp,
  Eraser,
  Maximize2,
  Minimize2,
  RotateCcw,
  Scan,
  Tag,
} from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { DeviceGlyph } from './DeviceIcon.tsx';
import { DeviceTerminal } from './DeviceTerminal.tsx';
import { Inspector } from './Inspector.tsx';
import { PcWindow } from './PcWindow.tsx';
import { TopologyCanvas, type Positions, type Selection } from './TopologyCanvas.tsx';

export interface SandboxActions {
  onDrop: (kind: DeviceKind, x: number, y: number) => string | null;
  onConnect: (a: LinkEnd, b: LinkEnd) => string | null;
  onDeleteDevice: (id: string) => void;
  onDeleteLink: (index: number) => void;
}

interface Props {
  net: Network;
  /** Runs a line on a device and returns its output. */
  onLine: (device: string, line: string) => string;
  /** Bump to remount every console (lab reset). */
  epoch: number;
  restored?: number;
  positions: Positions;
  onMove: (id: string, x: number, y: number) => void;
  onMoveEnd?: () => void;
  onResetLayout?: () => void;
  sandbox?: SandboxActions;
}

interface KeyboardLock {
  lock?: (keys: string[]) => Promise<void>;
  unlock?: () => void;
}

const keyboard = () => (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;

/** Canvas + inspector + PC desktop + console dock. Shared by labs and the sandbox. */
export function Stage({ net, onLine, epoch, restored, positions, onMove, onMoveEnd, onResetLayout, sandbox }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [openPc, setOpenPc] = useState<string | null>(null);
  const consoles = net.topology.devices.filter((d) => d.kind !== 'pc').map((d) => d.id);
  const [active, setActive] = useState<string | null>(consoles[0] ?? null);
  const [fitSignal, setFitSignal] = useState(0);
  const [showPorts, setShowPorts] = useState(true);
  // About a third of the screen for the console, so the diagram stays readable.
  const [dockHeight, setDockHeight] = useState(() => Math.round(Math.min(340, Math.max(200, innerHeight * 0.34))));
  const [collapsed, setCollapsed] = useState(false);
  const [clearSignal, setClearSignal] = useState(0);
  const [focus, setFocus] = useState(false);
  const [cableMode, setCableMode] = useState(false);
  const [cableFrom, setCableFrom] = useState<LinkEnd | null>(null);
  const [portMenu, setPortMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  // Keep selections pointing at things that still exist (sandbox deletes).
  const activeId = active && net.devices.has(active) ? active : (consoles[0] ?? null);
  const sel = selected?.kind === 'device' && !net.devices.has(selected.id) ? null : selected;
  const pc = openPc && net.devices.has(openPc) ? openPc : null;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onFs = () => {
      const on = document.fullscreenElement === root.current;
      setFocus(on);
      if (!on) keyboard()?.unlock?.();
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFocus = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    try {
      await root.current!.requestFullscreen();
      // In fullscreen, the browser lets the page keep Ctrl+W, Ctrl+T and Ctrl+N.
      await keyboard()?.lock?.(['KeyW', 'KeyT', 'KeyN']);
      setToast({ ok: true, text: 'Focus mode: Ctrl+W now deletes a word. Press Esc (hold) to leave.' });
    } catch {
      setToast({ ok: false, text: "Your browser didn't allow focus mode." });
    }
  };

  const open = (id: string) => {
    const dev = net.devices.get(id);
    if (!dev) return;
    if (dev.kind === 'pc') {
      setOpenPc(id);
      setSelected(null);
    } else {
      setActive(id);
      setCollapsed(false);
    }
  };

  const cancelCable = () => {
    setCableMode(false);
    setCableFrom(null);
    setPortMenu(null);
  };

  const pickPort = (id: string, port: string) => {
    setPortMenu(null);
    if (!sandbox) return;
    if (!cableFrom) {
      setCableFrom({ device: id, port });
      setToast({ ok: true, text: `${net.device(id).running.hostname} ${shortName(port)} selected. Now click the other device.` });
      return;
    }
    const err = sandbox.onConnect(cableFrom, { device: id, port });
    setToast(err ? { ok: false, text: err } : { ok: true, text: 'Cable connected.' });
    cancelCable();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, .console-host');
      if (e.key === 'Escape' && cableMode) cancelCable();
      if (!sandbox || typing || (e.key !== 'Delete' && e.key !== 'Backspace')) return;
      if (sel?.kind === 'device') sandbox.onDeleteDevice(sel.id);
      if (sel?.kind === 'link') sandbox.onDeleteLink(sel.index);
      setSelected(null);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const startResize = (e: RPointerEvent) => {
    const startY = e.clientY;
    const startH = dockHeight;
    const max = (root.current?.clientHeight ?? 800) * 0.75;
    const move = (ev: PointerEvent) => setDockHeight(Math.min(max, Math.max(150, startH - (ev.clientY - startY))));
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  };

  const rootRect = () => root.current!.getBoundingClientRect();

  return (
    <div ref={root} className={`stage${focus ? ' focus' : ''}`}>
      <div className="canvas-area">
        <TopologyCanvas
          net={net}
          positions={positions}
          onMove={onMove}
          onMoveEnd={onMoveEnd}
          selected={sel}
          onSelect={setSelected}
          onOpen={open}
          showPorts={showPorts}
          fitSignal={fitSignal}
          cableMode={cableMode}
          cableFrom={cableFrom?.device ?? null}
          onCablePick={(id, x, y) => {
            const r = rootRect();
            setPortMenu({ id, x: x - r.left, y: y - r.top });
          }}
          onDropDevice={
            sandbox
              ? (kind, x, y) => {
                  const err = sandbox.onDrop(kind, x, y);
                  if (err) setToast({ ok: false, text: err });
                }
              : undefined
          }
        />

        <div className="canvas-tools" role="toolbar" aria-label="Canvas tools">
          <button className="tool" onClick={() => setFitSignal((s) => s + 1)} title="Fit to screen">
            <Scan size={16} />
          </button>
          <button
            className={`tool${showPorts ? ' on' : ''}`}
            onClick={() => setShowPorts((s) => !s)}
            title="Show port labels"
            aria-pressed={showPorts}
          >
            <Tag size={16} />
          </button>
          {onResetLayout && (
            <button
              className="tool"
              onClick={() => {
                onResetLayout();
                setFitSignal((s) => s + 1);
              }}
              title="Reset layout"
            >
              <RotateCcw size={16} />
            </button>
          )}
          {sandbox && (
            <button
              className={`tool wide${cableMode ? ' on' : ''}`}
              onClick={() => (cableMode ? cancelCable() : setCableMode(true))}
              aria-pressed={cableMode}
              title="Connect two devices with a cable"
            >
              <Cable size={16} /> {cableMode ? (cableFrom ? 'Pick 2nd device' : 'Pick 1st device') : 'Connect'}
            </button>
          )}
        </div>

        <div className="canvas-legend muted small">
          <span>
            <i className="tri up" /> up
          </span>
          <span>
            <i className="tri down" /> down
          </span>
          <span className="hide-sm">Drag to move · Double-click to open · Scroll to zoom</span>
        </div>

        <Inspector
          net={net}
          selection={sel}
          onClose={() => setSelected(null)}
          onOpen={open}
          onDeleteDevice={
            sandbox
              ? (id) => {
                  sandbox.onDeleteDevice(id);
                  setSelected(null);
                }
              : undefined
          }
          onDeleteLink={
            sandbox
              ? (i) => {
                  sandbox.onDeleteLink(i);
                  setSelected(null);
                }
              : undefined
          }
        />

        {pc && <PcWindow key={pc} net={net} pcId={pc} onLine={(line) => onLine(pc, line)} onClose={() => setOpenPc(null)} />}
      </div>

      {portMenu && (
        <div className="port-menu card" style={{ left: portMenu.x, top: portMenu.y }} role="menu">
          <div className="port-menu-head">
            <strong>{net.device(portMenu.id).running.hostname}</strong>
            <button className="icon-btn" onClick={() => setPortMenu(null)} aria-label="Close">
              ✕
            </button>
          </div>
          {physicalPorts(net.device(portMenu.id).kind).map((p) => {
            const used = !!net.peer(portMenu.id, p);
            return (
              <button key={p} role="menuitem" disabled={used} onClick={() => pickPort(portMenu.id, p)}>
                <span className="mono">{p}</span>
                {used && <span className="muted small">in use</span>}
              </button>
            );
          })}
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.ok ? 'ok' : 'bad'}`} role="status">
          {toast.text}
        </div>
      )}

      <div className="dock" style={{ height: collapsed ? undefined : dockHeight }}>
        {!collapsed && <div className="dock-resizer" onPointerDown={startResize} aria-hidden="true" />}
        <div className="dock-bar">
          <div className="dock-tabs" role="tablist" aria-label="Device consoles">
            {consoles.map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeId === id}
                onClick={() => {
                  setActive(id);
                  setCollapsed(false);
                }}
              >
                <DeviceGlyph kind={net.device(id).kind} size={22} />
                {net.device(id).running.hostname}
              </button>
            ))}
            {consoles.length === 0 && <span className="muted small">Add a switch or router to open a console.</span>}
          </div>
          <span className="dock-tip muted small">Ctrl+Backspace deletes a word · ? for help · Tab completes</span>
          <button className="icon-btn" onClick={() => setClearSignal((s) => s + 1)} title="Clear screen">
            <Eraser size={16} />
          </button>
          <button className="icon-btn" onClick={() => void toggleFocus()} title={focus ? 'Exit focus mode' : 'Focus mode (lets Ctrl+W delete a word)'}>
            {focus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button className="icon-btn" onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Show console' : 'Hide console'}>
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        <div className="dock-body" hidden={collapsed}>
          {consoles.map((id) => (
            <DeviceTerminal
              key={`${epoch}-${id}`}
              net={net}
              deviceId={id}
              active={!collapsed && activeId === id}
              clearSignal={clearSignal}
              intro={restored ? `% Restored your earlier session (${restored} commands).\n` : undefined}
              onLine={(line) => onLine(id, line)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
