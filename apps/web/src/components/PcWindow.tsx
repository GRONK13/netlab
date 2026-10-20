import { type Network } from '@netlab/sim';
import { ArrowLeft, Network as NetworkIcon, SquareTerminal, X } from 'lucide-react';
import { useRef, useState, type FormEvent, type PointerEvent as RPointerEvent } from 'react';
import { DeviceTerminal } from './DeviceTerminal.tsx';

interface Props {
  net: Network;
  pcId: string;
  onLine: (line: string) => string;
  onClose: () => void;
}

type App = 'home' | 'ipconfig' | 'cmd';

const IP = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const isIp = (s: string) => {
  const m = IP.exec(s);
  return !!m && m.slice(1).every((o) => Number(o) <= 255);
};
const isMask = (s: string) => {
  if (!isIp(s)) return false;
  const n = s.split('.').reduce((a, o) => ((a << 8) | Number(o)) >>> 0, 0);
  const inv = ~n >>> 0;
  return (inv & (inv + 1)) === 0 && n !== 0;
};

/** A simulated PC: a small desktop with IP Configuration and a Command Prompt. */
export function PcWindow({ net, pcId, onLine, onClose }: Props) {
  const [app, setApp] = useState<App>('home');
  const [pos, setPos] = useState({ x: 32, y: 24 });
  const drag = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null);
  const host = net.device(pcId).running.hostname;

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
    <div className="window card" style={{ left: pos.x, top: pos.y }} role="dialog" aria-label={`${host} desktop`}>
      <div
        className="window-bar"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={() => (drag.current = null)}
      >
        {app !== 'home' && (
          <button className="icon-btn" onClick={() => setApp('home')} aria-label="Back to desktop">
            <ArrowLeft size={16} />
          </button>
        )}
        <strong>{host}</strong>
        <span className="muted small">
          {app === 'home' ? 'Desktop' : app === 'ipconfig' ? 'IP Configuration' : 'Command Prompt'}
        </span>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {app === 'home' && (
        <div className="desktop">
          <button className="app-tile" onClick={() => setApp('ipconfig')}>
            <span className="app-icon blue">
              <NetworkIcon size={26} />
            </span>
            IP Configuration
          </button>
          <button className="app-tile" onClick={() => setApp('cmd')}>
            <span className="app-icon dark">
              <SquareTerminal size={26} />
            </span>
            Command Prompt
          </button>
        </div>
      )}
      {app === 'ipconfig' && <IpConfig net={net} pcId={pcId} onLine={onLine} />}
      {app === 'cmd' && (
        <div className="window-console">
          <DeviceTerminal
            net={net}
            deviceId={pcId}
            active
            intro={'NetLab PC Command Line 1.0\nType help for commands.\n'}
            onLine={onLine}
          />
        </div>
      )}
    </div>
  );
}

function IpConfig({ net, pcId, onLine }: { net: Network; pcId: string; onLine: (line: string) => string }) {
  const cur = net.device(pcId).running.pc ?? {};
  const [ip, setIp] = useState(cur.ip ?? '');
  const [mask, setMask] = useState(cur.mask ?? '');
  const [gw, setGw] = useState(cur.gateway ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = (e: FormEvent) => {
    e.preventDefault();
    if (!isIp(ip)) return setMsg({ ok: false, text: 'Enter a valid IPv4 address, like 192.168.1.10.' });
    if (!isMask(mask)) return setMsg({ ok: false, text: 'Enter a valid subnet mask, like 255.255.255.0.' });
    if (gw && !isIp(gw)) return setMsg({ ok: false, text: 'Enter a valid default gateway, or leave it empty.' });
    // The GUI sends the same command a student could type, so grading stays replayable.
    onLine(`ipconfig ${ip} ${mask}${gw ? ` ${gw}` : ''}`);
    setMsg({ ok: true, text: 'Saved.' });
  };

  const fillMask = () => {
    if (mask || !isIp(ip)) return;
    const first = Number(ip.split('.')[0]);
    setMask(first < 128 ? '255.0.0.0' : first < 192 ? '255.255.0.0' : '255.255.255.0');
  };

  return (
    <form className="ipconfig" onSubmit={apply}>
      <fieldset>
        <legend>Interface FastEthernet0</legend>
        <label className="radio">
          <input type="radio" disabled /> DHCP <span className="muted small">(no DHCP server here yet)</span>
        </label>
        <label className="radio">
          <input type="radio" checked readOnly /> Static
        </label>
      </fieldset>
      <label>
        IPv4 Address
        <input className="mono" value={ip} onChange={(e) => setIp(e.target.value.trim())} onBlur={fillMask} placeholder="192.168.1.10" inputMode="decimal" />
      </label>
      <label>
        Subnet Mask
        <input className="mono" value={mask} onChange={(e) => setMask(e.target.value.trim())} placeholder="255.255.255.0" inputMode="decimal" />
      </label>
      <label>
        Default Gateway
        <input className="mono" value={gw} onChange={(e) => setGw(e.target.value.trim())} placeholder="optional" inputMode="decimal" />
      </label>
      {msg && <p className={msg.ok ? 'ok small' : 'error small'}>{msg.text}</p>}
      <button className="btn primary">Apply</button>
    </form>
  );
}
