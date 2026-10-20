import { isEndpoint, shortName, type DeviceKind, type Network } from '@netlab/sim';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { DeviceShape, displayName, IconDefs } from './DeviceIcon.tsx';

/** World units: device x/y are percentages, mapped onto a 1000 x 500 canvas. */
const WX = 10;
const WY = 5;

export type Selection = { kind: 'device'; id: string } | { kind: 'link'; index: number } | null;
export type Positions = Record<string, { x: number; y: number }>;

interface Props {
  net: Network;
  positions: Positions;
  onMove: (id: string, x: number, y: number) => void;
  onMoveEnd?: () => void;
  selected: Selection;
  onSelect: (s: Selection) => void;
  /** Double-click: open the console, or the desktop for a PC. */
  onOpen: (id: string) => void;
  showPorts: boolean;
  fitSignal: number;
  /** Sandbox: clicking a device picks a port for a new cable. */
  cableMode?: boolean;
  cableFrom?: string | null;
  onCablePick?: (id: string, clientX: number, clientY: number) => void;
  onDropDevice?: (kind: DeviceKind, x: number, y: number, model?: string) => void;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Drag =
  | { kind: 'device'; id: string; ox: number; oy: number; sx: number; sy: number; moved: boolean }
  | { kind: 'pan'; sx: number; sy: number; vb: ViewBox; moved: boolean }
  | null;

export const DND_TYPE = 'application/x-netlab-device';
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function fitView(positions: Positions, width: number, height: number): ViewBox {
  const pts = Object.values(positions);
  if (pts.length === 0) return { x: 0, y: 0, w: 1000, h: 600 };
  const xs = pts.map((p) => p.x * WX);
  const ys = pts.map((p) => p.y * WY);
  const pad = 80;
  let x = Math.min(...xs) - pad;
  let y = Math.min(...ys) - 60;
  let w = Math.max(...xs) - Math.min(...xs) + pad * 2;
  // Extra room below for the name and model labels.
  let h = Math.max(...ys) - Math.min(...ys) + 140;
  // Never zoom in so far that a couple of devices fill the screen.
  w = Math.max(w, 680);
  h = Math.max(h, 340);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2 + 20;
  x = cx - w / 2;
  y = cy - h / 2;
  // Match the element's aspect ratio so nothing is squashed.
  const aspect = width > 0 && height > 0 ? width / height : 1000 / 600;
  if (w / h > aspect) {
    const nh = w / aspect;
    y -= (nh - h) / 2;
    h = nh;
  } else {
    const nw = h * aspect;
    x -= (nw - w) / 2;
    w = nw;
  }
  return { x, y, w, h };
}

/**
 * The network diagram. Drag devices to rearrange, drag the background to pan,
 * scroll to zoom, click to inspect, double-click to open a console or PC.
 */
export function TopologyCanvas(props: Props) {
  const { net, positions, selected, showPorts, cableMode, cableFrom } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState<ViewBox>({ x: 0, y: 0, w: 1000, h: 600 });
  const drag = useRef<Drag>(null);
  const lastClick = useRef<{ id: string; t: number } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const fit = useCallback(() => {
    const el = svgRef.current;
    setVb(fitView(propsRef.current.positions, el?.clientWidth ?? 0, el?.clientHeight ?? 0));
  }, []);

  // Re-fit when asked, and when devices are added or removed (sandbox).
  useLayoutEffect(fit, [fit, props.fitSignal, net.topology.devices.length]);

  useEffect(() => {
    const el = svgRef.current!;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = toWorld(e.clientX, e.clientY);
      const k = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      setVb((v) => {
        const w = clamp(v.w * k, 300, 3000);
        const s = w / v.w;
        return { x: pt.x - (pt.x - v.x) * s, y: pt.y - (pt.y - v.y) * s, w, h: v.h * s };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  }, [fit]);

  const toWorld = (cx: number, cy: number) => {
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(cx, cy).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onDevicePointerDown = (e: RPointerEvent, id: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (cableMode) {
      props.onCablePick?.(id, e.clientX, e.clientY);
      return;
    }
    const w = toWorld(e.clientX, e.clientY);
    const p = positions[id]!;
    drag.current = { kind: 'device', id, ox: w.x - p.x * WX, oy: w.y - p.y * WY, sx: e.clientX, sy: e.clientY, moved: false };
    svgRef.current!.setPointerCapture(e.pointerId);
  };

  const onBackgroundPointerDown = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vb, moved: false };
    svgRef.current!.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
    d.moved = true;
    if (d.kind === 'device') {
      const w = toWorld(e.clientX, e.clientY);
      props.onMove(d.id, clamp((w.x - d.ox) / WX, -40, 140), clamp((w.y - d.oy) / WY, -40, 140));
    } else {
      const el = svgRef.current!;
      const scale = d.vb.w / el.clientWidth;
      setVb({ ...d.vb, x: d.vb.x - (e.clientX - d.sx) * scale, y: d.vb.y - (e.clientY - d.sy) * scale });
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === 'device') {
      if (d.moved) {
        props.onMoveEnd?.();
        return;
      }
      // Pointer capture swallows the browser's dblclick, so detect it here.
      const now = performance.now();
      const last = lastClick.current;
      if (last && last.id === d.id && now - last.t < 400) {
        lastClick.current = null;
        props.onOpen(d.id);
      } else {
        lastClick.current = { id: d.id, t: now };
        props.onSelect({ kind: 'device', id: d.id });
      }
    } else if (!d.moved) {
      props.onSelect(null);
    }
  };

  const devices = net.topology.devices;
  const at = (id: string) => {
    const p = positions[id] ?? { x: 50, y: 50 };
    return { x: p.x * WX, y: p.y * WY };
  };

  return (
    <svg
      ref={svgRef}
      className={`canvas${cableMode ? ' cable-mode' : ''}`}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDragOver={(e) => {
        if (props.onDropDevice && e.dataTransfer.types.includes(DND_TYPE)) e.preventDefault();
      }}
      onDrop={(e) => {
        // Payload is "kind:model", e.g. "router:1941".
        const [kind, model] = e.dataTransfer.getData(DND_TYPE).split(':') as [DeviceKind, string | undefined];
        if (!kind || !props.onDropDevice) return;
        e.preventDefault();
        const w = toWorld(e.clientX, e.clientY);
        props.onDropDevice(kind, w.x / WX, w.y / WY, model);
      }}
      role="application"
      aria-label="Network topology. Drag devices to rearrange; double-click to open."
    >
      <IconDefs />
      <defs>
        <pattern id="nl-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className="grid-dot" />
        </pattern>
      </defs>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#nl-grid)" />

      {net.topology.links.map((l, i) => {
        const a = at(l.a.device);
        const b = at(l.b.device);
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ux = (b.x - a.x) / len;
        const uy = (b.y - a.y) / len;
        const isSel = selected?.kind === 'link' && selected.index === i;
        const end = (p: { x: number; y: number }, dir: 1 | -1, device: string, port: string) => {
          const d = Math.min(40, len / 2 - 6);
          const cx = p.x + ux * d * dir;
          const cy = p.y + uy * d * dir;
          const up = net.linkUp(device, port);
          // A small triangle pointing along the cable, like Packet Tracer's link lights.
          const tx = ux * dir;
          const ty = uy * dir;
          const pts = [
            [cx + tx * 6, cy + ty * 6],
            [cx - tx * 4 - ty * 5, cy - ty * 4 + tx * 5],
            [cx - tx * 4 + ty * 5, cy - ty * 4 - tx * 5],
          ]
            .map(([x, y]) => `${x},${y}`)
            .join(' ');
          const lx = p.x + ux * (d + 22) * dir - uy * 13;
          const ly = p.y + uy * (d + 22) * dir + ux * 13;
          return (
            <g key={`${device}-${port}`}>
              <polygon points={pts} className={up ? 'light up' : 'light down'}>
                <title>{`${net.device(device).running.hostname} ${port}: ${up ? 'up' : 'down'}`}</title>
              </polygon>
              {showPorts && (
                <text x={lx} y={ly + 4} className="port-label" textAnchor="middle">
                  {shortName(port)}
                </text>
              )}
            </g>
          );
        };
        return (
          <g key={i} className={`link${isSel ? ' selected' : ''}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="cable" />
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="cable-hit"
              onPointerDown={(e) => {
                e.stopPropagation();
                if (!cableMode) props.onSelect({ kind: 'link', index: i });
              }}
            />
            {end(a, 1, l.a.device, l.a.port)}
            {end(b, -1, l.b.device, l.b.port)}
          </g>
        );
      })}

      {devices.map((d) => {
        const p = at(d.id);
        const dev = net.device(d.id);
        const isSel = selected?.kind === 'device' && selected.id === d.id;
        const sub = isEndpoint(d.kind) ? (dev.running.pc?.ip ?? 'No IP') : dev.model;
        return (
          <g
            key={d.id}
            transform={`translate(${p.x} ${p.y})`}
            className={`node${isSel ? ' selected' : ''}${cableFrom === d.id ? ' cable-from' : ''}`}
            tabIndex={0}
            role="button"
            aria-label={`${displayName(dev)}, ${d.kind}. Press Enter to open.`}
            onPointerDown={(e) => onDevicePointerDown(e, d.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') props.onOpen(d.id);
              if (e.key === ' ') props.onSelect({ kind: 'device', id: d.id });
            }}
          >
            <rect x="-46" y="-34" width="92" height="92" rx="14" className="halo" />
            <DeviceShape kind={d.kind} />
            <text y="36" className="node-name" textAnchor="middle">
              {displayName(dev)}
            </text>
            <text y="50" className="node-sub" textAnchor="middle">
              {sub}
            </text>
          </g>
        );
      })}

      {devices.length === 0 && (
        <text x={vb.x + vb.w / 2} y={vb.y + vb.h / 2} textAnchor="middle" className="canvas-empty">
          Drag a device here from the left panel
        </text>
      )}
    </svg>
  );
}
