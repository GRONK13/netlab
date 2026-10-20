import type { Network } from '@netlab/sim';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';

interface Props {
  net: Network;
  deviceId: string;
  active: boolean;
  intro?: string;
  /** Runs a typed line (and records it). Returns the device's output. */
  onLine: (line: string) => string;
}

const THEME = {
  background: '#0d1117',
  foreground: '#d6dde6',
  cursor: '#7ee2b8',
  selectionBackground: '#2f4a63',
};

/** One console per device, like clicking a device's CLI tab in Packet Tracer. */
export function DeviceTerminal({ net, deviceId, active, intro, onLine }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  // Keep the latest callback without re-creating the terminal.
  const onLineRef = useRef(onLine);
  onLineRef.current = onLine;

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace',
      fontSize: 14,
      scrollback: 2000,
      theme: THEME,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current!);
    termRef.current = term;
    fitRef.current = fit;

    let line = '';
    const history: string[] = [];
    let hIdx = 0;
    const prompt = () => net.prompt(deviceId);
    const secret = () => net.isSecretInput(deviceId);
    const redraw = () => term.write(`\r\x1b[2K${prompt()}${secret() ? '' : line}`);
    const print = (out: string) => {
      if (out) term.write(out.endsWith('\n') ? out : `${out}\n`);
    };

    if (intro) term.write(`${intro}\n`);
    term.write(prompt());

    const enter = (text: string) => {
      const wasSecret = secret();
      term.write('\n');
      if (!wasSecret && text.trim()) {
        history.push(text);
        if (history.length > 100) history.shift();
      }
      hIdx = history.length;
      print(onLineRef.current(text));
      term.write(prompt());
    };

    const handleChar = (ch: string) => {
      switch (ch) {
        case '\r':
        case '\n': {
          const text = line;
          line = '';
          enter(text);
          return;
        }
        case '\x7f':
        case '\b':
          if (line.length) {
            line = line.slice(0, -1);
            if (!secret()) term.write('\b \b');
          }
          return;
        case '\t': {
          if (secret()) return;
          const done = net.complete(deviceId, line);
          if (done) {
            line = done;
            redraw();
          }
          return;
        }
        case '\x03': // Ctrl+C
          line = '';
          term.write('^C\n');
          term.write(prompt());
          return;
        case '\x1a': // Ctrl+Z = end
          if (prompt().includes('(config')) {
            line = '';
            term.write('^Z');
            enter('end');
          }
          return;
        case '?':
          if (!secret()) {
            term.write('?\n');
            print(net.help(deviceId, line));
            term.write(prompt() + line);
            return;
          }
          break;
      }
      if (ch >= ' ' && line.length < 300) {
        line += ch;
        if (!secret()) term.write(ch);
      }
    };

    const sub = term.onData((data) => {
      for (let i = 0; i < data.length; i++) {
        const ch = data[i]!;
        if (ch === '\x1b') {
          const seq = data.slice(i, i + 3);
          i += 2;
          if (secret() || !history.length) continue;
          if (seq === '\x1b[A') hIdx = Math.max(0, hIdx - 1);
          else if (seq === '\x1b[B') hIdx = Math.min(history.length, hIdx + 1);
          else continue;
          line = history[hIdx] ?? '';
          redraw();
          continue;
        }
        // A pasted "\r\n" is one Enter.
        if (ch === '\n' && data[i - 1] === '\r') continue;
        handleChar(ch);
      }
    });

    const ro = new ResizeObserver(() => {
      if (host.current?.offsetParent) fit.fit();
    });
    ro.observe(host.current!);

    return () => {
      ro.disconnect();
      sub.dispose();
      term.dispose();
      termRef.current = null;
    };
    // The terminal is created once per device; the parent remounts it on lab reset.
  }, []);

  useEffect(() => {
    if (active && termRef.current) {
      fitRef.current?.fit();
      termRef.current.focus();
    }
  }, [active]);

  return <div ref={host} className="console-host" hidden={!active} aria-label={`${deviceId} console`} />;
}
