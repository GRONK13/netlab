import { shortName, type Network } from '@netlab/sim';

const W = 640;
const H = 300;

function Icon({ kind }: { kind: string }) {
  if (kind === 'router') {
    return (
      <g>
        <circle r="22" className="dev-body" />
        <path d="M-12 -5 h18 l-5 -5 M12 5 h-18 l5 5" className="dev-glyph" />
      </g>
    );
  }
  if (kind === 'switch') {
    return (
      <g>
        <rect x="-30" y="-16" width="60" height="32" rx="6" className="dev-body" />
        <path d="M-16 -5 h28 l-5 -4 M16 5 h-28 l5 4" className="dev-glyph" />
      </g>
    );
  }
  return (
    <g>
      <rect x="-18" y="-17" width="36" height="25" rx="3" className="dev-body" />
      <path d="M-8 14 h16 M0 8 v6" className="dev-line" />
    </g>
  );
}

/** Live network diagram: link lights turn green when both ends are up. Click a device to open its console. */
export function Topology({ net, active, onSelect }: { net: Network; active: string; onSelect: (id: string) => void }) {
  const pos = new Map(net.topology.devices.map((d) => [d.id, { x: (d.x / 100) * W, y: (d.y / 100) * H }]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="topology" role="group" aria-label="Network topology">
      {net.topology.links.map((l, i) => {
        const a = pos.get(l.a.device)!;
        const b = pos.get(l.b.device)!;
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ux = (b.x - a.x) / len;
        const uy = (b.y - a.y) / len;
        const end = (p: { x: number; y: number }, dir: number, device: string, port: string) => {
          const d = 40;
          const x = p.x + ux * d * dir;
          const y = p.y + uy * d * dir;
          const up = net.linkUp(device, port);
          return (
            <g key={port}>
              <circle cx={x} cy={y} r="5" className={up ? 'light up' : 'light down'}>
                <title>{`${device} ${port}: ${up ? 'up' : 'down'}`}</title>
              </circle>
              <text x={x - uy * 14} y={y + ux * 14 + 4} className="port-label" textAnchor="middle">
                {shortName(port)}
              </text>
            </g>
          );
        };
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="cable" />
            {end(a, 1, l.a.device, l.a.port)}
            {end(b, -1, l.b.device, l.b.port)}
          </g>
        );
      })}
      {net.topology.devices.map((d) => {
        const p = pos.get(d.id)!;
        const dev = net.device(d.id);
        const sub = d.kind === 'pc' ? (dev.running.pc?.ip ?? 'no IP') : dev.model;
        return (
          <g
            key={d.id}
            transform={`translate(${p.x} ${p.y})`}
            className={`device ${d.kind}${active === d.id ? ' selected' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`Open ${dev.running.hostname} console`}
            onClick={() => onSelect(d.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(d.id)}
          >
            <Icon kind={d.kind} />
            <text y={d.kind === 'switch' ? 32 : 38} className="dev-name" textAnchor="middle">
              {dev.running.hostname}
            </text>
            <text y={d.kind === 'switch' ? 46 : 52} className="dev-sub" textAnchor="middle">
              {sub}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
