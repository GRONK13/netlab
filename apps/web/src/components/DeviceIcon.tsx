import type { DeviceKind } from '@netlab/sim';

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
    </defs>
  );
}

const ARROW = { fill: 'none', stroke: '#fff', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Classic Cisco router: a cylinder with four arrows on top. */
function Router() {
  return (
    <g>
      <path d="M-32 -4 v14 a32 9 0 0 0 64 0 v-14 z" fill="url(#nl-body)" stroke="#173f72" strokeWidth="1" />
      <ellipse cx="0" cy="-4" rx="32" ry="9" fill="url(#nl-top)" stroke="#173f72" strokeWidth="1" />
      {/* Two arrows pointing in, two pointing out */}
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
      <path d="M-36 -6 l8 -9 h64 l-8 9 z" fill="url(#nl-top)" stroke="#173f72" strokeWidth="1" />
      <path d="M28 -6 l8 -9 v18 l-8 9 z" fill="url(#nl-side)" stroke="#173f72" strokeWidth="1" />
      <rect x="-36" y="-6" width="64" height="18" fill="url(#nl-body)" stroke="#173f72" strokeWidth="1" />
      <path d="M-24 -12.5 h20 m-3.5 -2.2 l3.5 2.2 l-3.5 2.2" {...ARROW} strokeWidth={1.7} />
      <path d="M6 -12.5 h20 m-3.5 -2.2 l3.5 2.2 l-3.5 2.2" {...ARROW} strokeWidth={1.7} />
      <path d="M-4 -8.5 h-20 m3.5 -2.2 l-3.5 2.2 l3.5 2.2" {...ARROW} strokeWidth={1.7} />
      <path d="M26 -8.5 h-20 m3.5 -2.2 l-3.5 2.2 l3.5 2.2" {...ARROW} strokeWidth={1.7} />
      {/* Port LEDs on the front */}
      {[-28, -20, -12, -4, 4, 12].map((x) => (
        <rect key={x} x={x} y="5" width="5" height="3" rx="0.8" fill="#9fd0ff" opacity="0.75" />
      ))}
    </g>
  );
}

/** Desktop PC: monitor on a stand. */
function Pc() {
  return (
    <g>
      <rect x="-22" y="-24" width="44" height="31" rx="3" fill="url(#nl-case)" stroke="#6b7280" strokeWidth="1" />
      <rect x="-18.5" y="-20.5" width="37" height="24" rx="1.5" fill="url(#nl-screen)" />
      <path d="M-14 -16 h12 M-14 -12 h20 M-14 -8 h8" stroke="#e0f2fe" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <path d="M-5 7 h10 l3 7 h-16 z" fill="#c9ced6" stroke="#6b7280" strokeWidth="1" />
      <rect x="-17" y="14" width="34" height="4" rx="1.5" fill="#d8dce2" stroke="#6b7280" strokeWidth="1" />
    </g>
  );
}

export function DeviceShape({ kind }: { kind: DeviceKind }) {
  if (kind === 'router') return <Router />;
  if (kind === 'switch') return <Switch />;
  return <Pc />;
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

export const KIND_LABEL: Record<DeviceKind, string> = {
  switch: 'Switch',
  router: 'Router',
  pc: 'PC',
};

export const MODEL_LABEL: Record<DeviceKind, string> = {
  switch: '2960-24TT',
  router: '2911',
  pc: 'PC-PT',
};
