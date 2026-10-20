import { browse, defaultPage, macFor, type Network, type WebResponse } from '@netlab/sim';
import { ArrowRight, Globe, RotateCw, ServerCrash, Unplug } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DeviceTerminal } from '../DeviceTerminal.tsx';

export interface AppProps {
  net: Network;
  id: string;
  active: boolean;
  onLine: (line: string) => string;
  /** Called after a direct config change (web page edits). */
  onMutate: () => void;
}

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

export function CommandPrompt({ net, id, active, onLine }: AppProps) {
  return (
    <div className="app-cmd">
      <DeviceTerminal
        net={net}
        deviceId={id}
        active={active}
        intro={'NetLab PC Command Line 1.0\nType help for a list of commands.\n'}
        onLine={onLine}
      />
    </div>
  );
}

/** IP Configuration, laid out like the Packet Tracer dialog. */
export function IpConfiguration({ net, id, onLine }: AppProps) {
  const cur = net.device(id).running.pc ?? {};
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
    setMsg({ ok: true, text: 'Settings saved.' });
  };

  const fillMask = () => {
    if (mask || !isIp(ip)) return;
    const first = Number(ip.split('.')[0]);
    setMask(first < 128 ? '255.0.0.0' : first < 192 ? '255.255.0.0' : '255.255.255.0');
  };

  return (
    <form className="app-form" onSubmit={apply}>
      <div className="form-section">
        <div className="form-section-title">Interface</div>
        <div className="form-row">
          <span>Port</span>
          <span className="mono">FastEthernet0</span>
        </div>
        <div className="form-row">
          <span>MAC address</span>
          <span className="mono">{macFor(id).toUpperCase()}</span>
        </div>
      </div>
      <div className="form-section">
        <div className="form-section-title">IPv4 configuration</div>
        <div className="radio-row">
          <label>
            <input type="radio" disabled /> DHCP
          </label>
          <label>
            <input type="radio" checked readOnly /> Static
          </label>
        </div>
        <label className="form-row">
          <span>IPv4 Address</span>
          <input className="mono" value={ip} onChange={(e) => setIp(e.target.value.trim())} onBlur={fillMask} placeholder="192.168.1.10" />
        </label>
        <label className="form-row">
          <span>Subnet Mask</span>
          <input className="mono" value={mask} onChange={(e) => setMask(e.target.value.trim())} placeholder="255.255.255.0" />
        </label>
        <label className="form-row">
          <span>Default Gateway</span>
          <input className="mono" value={gw} onChange={(e) => setGw(e.target.value.trim())} placeholder="optional" />
        </label>
        <label className="form-row">
          <span>DNS Server</span>
          <input className="mono" value="" disabled placeholder="No DNS server yet" />
        </label>
      </div>
      <div className="form-actions">
        {msg && <span className={msg.ok ? 'ok small' : 'bad small'}>{msg.text}</span>}
        <button className="btn primary small">Save</button>
      </div>
    </form>
  );
}

export function WebBrowser({ net, id }: AppProps) {
  const [url, setUrl] = useState('http://');
  const [res, setRes] = useState<WebResponse | null>(null);

  const go = (e?: FormEvent) => {
    e?.preventDefault();
    setRes(browse(net, id, url));
  };

  return (
    <div className="app-browser">
      <form className="browser-bar" onSubmit={go}>
        <button type="button" className="icon-btn" onClick={() => go()} aria-label="Reload" disabled={!res}>
          <RotateCw size={14} />
        </button>
        <span className="url">
          <Globe size={13} />
          <input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Address" spellCheck={false} />
        </span>
        <button className="icon-btn" aria-label="Go">
          <ArrowRight size={15} />
        </button>
      </form>
      <div className="browser-view">
        {!res && (
          <div className="browser-start">
            <Globe size={30} />
            <p>Type a server's address and press Enter.</p>
            <p className="muted small">
              Example: <span className="mono">http://192.168.1.100</span>
            </p>
          </div>
        )}
        {res?.ok && (
          <article className="web-page">
            <h1>{res.page.title}</h1>
            {res.page.body.split('\n').map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <footer>Served by {res.host} over HTTP</footer>
          </article>
        )}
        {res && !res.ok && (
          <div className="browser-error">
            {res.error === 'Connection refused' ? <ServerCrash size={30} /> : <Unplug size={30} />}
            <h2>{res.error}</h2>
            <p>{res.detail}</p>
            <p className="muted small">
              Tip: test the path first with <span className="mono">ping</span> in Command Prompt.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Servers only: the page their HTTP service returns. */
export function WebServer({ net, id, onMutate }: AppProps) {
  const dev = net.device(id);
  const page = dev.running.http ?? defaultPage(dev.running.hostname);
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [saved, setSaved] = useState(false);

  const save = (e: FormEvent) => {
    e.preventDefault();
    dev.running.http = { title: title.slice(0, 120), body: body.slice(0, 2000) };
    onMutate();
    setSaved(true);
  };

  return (
    <form className="app-form" onSubmit={save}>
      <div className="form-section">
        <div className="form-section-title">HTTP service</div>
        <div className="form-row">
          <span>Status</span>
          <span className="ok small">On · port 80</span>
        </div>
        <div className="form-row">
          <span>Address</span>
          <span className="mono">{dev.running.pc?.ip ? `http://${dev.running.pc.ip}` : 'Set an IP address first'}</span>
        </div>
      </div>
      <div className="form-section">
        <div className="form-section-title">index.html</div>
        <label className="form-row">
          <span>Title</span>
          <input value={title} onChange={(e) => (setTitle(e.target.value), setSaved(false))} maxLength={120} />
        </label>
        <label className="form-row top">
          <span>Content</span>
          <textarea value={body} onChange={(e) => (setBody(e.target.value), setSaved(false))} rows={5} maxLength={2000} />
        </label>
      </div>
      <div className="form-actions">
        {saved && <span className="ok small">Published.</span>}
        <button className="btn primary small">Save page</button>
      </div>
    </form>
  );
}
