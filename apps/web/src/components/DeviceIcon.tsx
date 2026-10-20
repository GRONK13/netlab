import type { DeviceKind } from '@netlab/sim';
import type { JSX } from 'react';

/** Gradients shared by every device icon. Render once per <svg>. */
export function IconDefs() {
  return (
    <defs>
      <linearGradient id="nl-top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8fc1ee" />
        <stop offset="1" stopColor="#4d8fd1" />
      </linearGradient>
      <linearGradient id="nl-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2f73c0" />
        <stop offset="1" stopColor="#1b4f8f" />
      </linearGradient>
      <linearGradient id="nl-side" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#1f5aa0" />
        <stop offset="1" stopColor="#163f73" />
      </linearGradient>
      <linearGradient id="nl-screen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7cc4f7" />
        <stop offset="1" stopColor="#2b6fb6" />
      </linearGradient>
      <linearGradient id="nl-case" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f3f4f6" />
        <stop offset="1" stopColor="#c9ced6" />
      </linearGradient>
      <linearGradient id="nl-dark" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#4b5563" />
        <stop offset="1" stopColor="#1f2937" />
      </linearGradient>
    </defs>
  );
}

const ARROW = { fill: 'none', stroke: '#fff', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const EDGE = { stroke: '#173f72', strokeWidth: 1 } as const;
const GREY = { stroke: '#6b7280', strokeWidth: 1 } as const;

/** Classic Cisco router: a cylinder with four arrows on top. */
function Router() {
  return (
    <g>
      <path d="M-32 -4 v14 a32 9 0 0 0 64 0 v-14 z" fill="url(#nl-body)" {...EDGE} />
      <ellipse cx="0" cy="-4" rx="32" ry="9" fill="url(#nl-top)" {...EDGE} />
      <path d="M-25 -4 h12 m-4 -3 l4 3 l-4 3" {...ARROW} />
      <path d="M25 -4 h-12 m4 -3 l-4 3 l4 3" {...ARROW} />
      <path d="M-4 -6.5 l-9 -4.5 m1 3.6 l-1 -3.6 l3.8 -0.4" {...ARROW} strokeWidth={1.8} />
      <path d="M4 -1.5 l9 4.5 m-1 -3.6 l1 3.6 l-3.8 0.4" {...ARROW} strokeWidth={1.8} />
    </g>
  );
}

/** Classic Cisco workgroup switch: a box with arrows both ways on top. */
function Switch() {
  return (
    <g>
      <path d="M-36 -6 l8 -9 h64 l-8 9 z" fill="url(#nl-top)" {...EDGE} />
      <path d="M28 -6 l8 -9 v18 l-8 9 z" fill="url(#nl-side)" {...EDGE} />
      <rect x="-36" y="-6" width="64" height="18" fill="url(#nl-body)" {...EDGE} />
      <path d="M-24 -12.5 h20 m-3.5 -2.2 l3.5 2.2 l-3.5 2.2" {...ARROW} strokeWidth={1.7} />
      <path d="M6 -12.5 h20 m-3.5 -2.2 l3.5 2.2 l-3.5 2.2" {...ARROW} strokeWidth={1.7} />
      <path d="M-4 -8.5 h-20 m3.5 -2.2 l-3.5 2.2 l3.5 2.2" {...ARROW} strokeWidth={1.7} />
      <path d="M26 -8.5 h-20 m3.5 -2.2 l-3.5 2.2 l3.5 2.2" {...ARROW} strokeWidth={1.7} />
      {[-28, -20, -12, -4, 4, 12].map((x) => (
        <rect key={x} x={x} y="5" width="5" height="3" rx="0.8" fill="#9fd0ff" opacity="0.75" />
      ))}
    </g>
  );
}

/** Hub: a flatter box with a single two-way arrow, like the Cisco hub icon. */
function Hub() {
  return (
    <g>
      <path d="M-34 -3 l7 -7 h60 l-7 7 z" fill="url(#nl-top)" {...EDGE} />
      <path d="M26 -3 l7 -7 v12 l-7 7 z" fill="url(#nl-side)" {...EDGE} />
      <rect x="-34" y="-3" width="60" height="12" fill="url(#nl-body)" {...EDGE} />
      <path d="M-22 -6.5 h40 m-4 -2.3 l4 2.3 l-4 2.3 M-22 -6.5 l4 -2.3 M-22 -6.5 l4 2.3" {...ARROW} strokeWidth={1.6} />
    </g>
  );
}

/** Desktop PC: monitor on a stand. */
function Pc() {
  return (
    <g>
      <rect x="-22" y="-24" width="44" height="31" rx="3" fill="url(#nl-case)" {...GREY} />
      <rect x="-18.5" y="-20.5" width="37" height="24" rx="1.5" fill="url(#nl-screen)" />
      <path d="M-14 -16 h12 M-14 -12 h20 M-14 -8 h8" stroke="#e0f2fe" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <path d="M-5 7 h10 l3 7 h-16 z" fill="#c9ced6" {...GREY} />
      <rect x="-17" y="14" width="34" height="4" rx="1.5" fill="#d8dce2" {...GREY} />
    </g>
  );
}

/** Laptop: open lid on a thin base. */
function Laptop() {
  return (
    <g>
      <rect x="-20" y="-22" width="40" height="27" rx="2.5" fill="url(#nl-case)" {...GREY} />
      <rect x="-17" y="-19" width="34" height="21" rx="1" fill="url(#nl-screen)" />
      <path d="M-13 -15 h11 M-13 -11 h18" stroke="#e0f2fe" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <path d="M-26 6 h52 l-4 6 h-44 z" fill="#d8dce2" {...GREY} />
      <rect x="-6" y="7.5" width="12" height="2" rx="1" fill="#9ca3af" />
    </g>
  );
}

/** Tower server with drive bays and status lights. */
function Server() {
  return (
    <g>
      <rect x="-15" y="-26" width="30" height="44" rx="2.5" fill="url(#nl-dark)" stroke="#111827" strokeWidth="1" />
      {[-21, -14, -7].map((y) => (
        <g key={y}>
          <rect x="-11" y={y} width="22" height="5" rx="1" fill="#6b7280" />
          <circle cx="8" cy={y + 2.5} r="1.1" fill="#4ade80" />
        </g>
      ))}
      <path d="M-11 2 h22 M-11 6 h22 M-11 10 h22" stroke="#374151" strokeWidth="1.2" />
      <circle cx="0" cy="14" r="1.8" fill="#60a5fa" />
    </g>
  );
}

/** Network printer with a paper tray. */
function Printer() {
  return (
    <g>
      <rect x="-12" y="-24" width="24" height="12" fill="#ffffff" stroke="#9ca3af" strokeWidth="1" />
      <rect x="-24" y="-12" width="48" height="20" rx="3" fill="url(#nl-case)" {...GREY} />
      <rect x="-15" y="8" width="30" height="9" fill="#ffffff" stroke="#9ca3af" strokeWidth="1" />
      <path d="M-10 11.5 h20 M-10 14 h14" stroke="#9ca3af" strokeWidth="1" />
      <circle cx="17" cy="-4" r="1.6" fill="#4ade80" />
      <rect x="-19" y="-6" width="16" height="4" rx="1" fill="#6b7280" />
    </g>
  );
}

const SHAPES: Record<DeviceKind, () => JSX.Element> = {
  router: Router,
  switch: Switch,
  hub: Hub,
  pc: Pc,
  laptop: Laptop,
  server: Server,
  printer: Printer,
};

export function DeviceShape({ kind }: { kind: DeviceKind }) {
  const Shape = SHAPES[kind] ?? Pc;
  return <Shape />;
}

/** A standalone device icon for buttons, tabs and the palette. */
export function DeviceGlyph({ kind, size = 28 }: { kind: DeviceKind; size?: number }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="-40 -30 80 60" aria-hidden="true" className="device-glyph">
      <IconDefs />
      <DeviceShape kind={kind} />
    </svg>
  );
}

/**
 * Name shown on the canvas and tabs. Like Packet Tracer, show the device name
 * (Router0, Switch1) until the student sets a hostname of their own.
 */
export function displayName(dev: { id: string; running: { hostname: string } }): string {
  const h = dev.running.hostname;
  return h === 'Router' || h === 'Switch' ? dev.id : h;
}

export const KIND_LABEL: Record<DeviceKind, string> = {
  router: 'Router',
  switch: 'Switch',
  hub: 'Hub',
  pc: 'PC',
  laptop: 'Laptop',
  server: 'Server',
  printer: 'Printer',
};
