import type { Network } from '@netlab/sim';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';
import { decodeKeys, LineEditor, type Key } from '../console/lineEditor.ts';

interface Props {
  net: Network;
  deviceId: string;
  active: boolean;
  intro?: string;
  /** Runs a typed line (and records it). Returns the device's output. */
  onLine: (line: string) => string;
  /** Bump to clear the screen. */
  clearSignal?: number;
}

const THEME = {
  background: '#161512',
  foreground: '#e6e1d6',
  cursor: '#f76707',
  cursorAccent: '#161512',
  selectionBackground: '#4a4337',
  green: '#69db7c',
  brightBlack: '#8a8478',
};

const FONT = '"IBM Plex Mono", Consolas, "Courier New", monospace';

const MORE = ' --More-- ';

/**
 * A device console. Line editing follows Cisco IOS: Ctrl+A/E, Ctrl+B/F, Ctrl+W,
 * Ctrl+U, Ctrl+K, Ctrl+P/N, Tab, `?`, plus arrows, Home/End and Ctrl+arrows.
 * Long output pauses at --More-- (Space = next page, Enter = next line, q = stop).
 */
export function DeviceTerminal({ net, deviceId, active, intro, onLine, clearSignal }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const onLineRef = useRef(onLine);
  onLineRef.current = onLine;

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: `${FONT}, ui-monospace`,
      fontSize: 14,
      lineHeight: 1.2,
      scrollback: 3000,
      theme: THEME,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current!);
    termRef.current = term;
    fitRef.current = fit;
    // xterm measures character width when it opens; re-measure once the web font has loaded.
    void document.fonts?.load('14px "IBM Plex Mono"').then(() => {
      if (termRef.current !== term) return;
      term.options.fontFamily = FONT;
      if (host.current?.offsetParent) fit.fit();
    });

    const ed = new LineEditor();
    let paging: string[] | null = null;
    const prompt = () => net.prompt(deviceId);
    const secret = () => net.isSecretInput(deviceId);

    const render = () => {
      const shown = secret() ? '' : ed.text;
      const back = secret() ? 0 : ed.text.length - ed.cursor;
      term.write(`\r\x1b[2K${prompt()}${shown}${back > 0 ? `\x1b[${back}D` : ''}`);
    };

    const pageSize = () => {
      const len = net.pageLength(deviceId);
      return len === 0 ? Infinity : Math.max(4, Math.min(len - 1, term.rows - 1));
    };

    /** Writes output, pausing at --More-- when it's longer than a screen. Returns true if paused. */
    const show = (out: string): boolean => {
      if (!out) return false;
      const lines = out.replace(/\n$/, '').split('\n');
      const size = pageSize();
      if (lines.length <= size) {
        term.write(`${lines.join('\n')}\n`);
        return false;
      }
      term.write(`${lines.slice(0, size).join('\n')}\n${MORE}`);
      paging = lines.slice(size);
      return true;
    };

    const continuePaging = (k: Key) => {
      const rest = paging!;
      term.write('\r\x1b[2K');
      const n = k.type === 'char' && k.ch === ' ' ? pageSize() : k.type === 'enter' ? 1 : 0;
      if (n === 0) {
        paging = null;
        render();
        return;
      }
      term.write(`${rest.slice(0, n).join('\n')}\n`);
      paging = rest.slice(n);
      if (paging.length) term.write(MORE);
      else {
        paging = null;
        render();
      }
    };

    const enter = (line: string) => {
      term.write('\n');
      if (!show(onLineRef.current(line))) render();
    };

    const handle = (k: Key) => {
      if (paging) return continuePaging(k);
      const hidden = secret();
      switch (k.type) {
        case 'char':
          if (k.ch === '?' && !hidden) {
            const before = ed.text;
            term.write(`${'\x1b[C'.repeat(ed.text.length - ed.cursor)}?\n`);
            if (!show(net.help(deviceId, before))) render();
            return;
          }
          ed.insert(k.ch);
          break;
        case 'enter': {
          ed.end();
          if (!hidden) render();
          enter(ed.take(!hidden));
          return;
        }
        case 'backspace':
          ed.backspace();
          break;
        case 'delete':
          ed.deleteChar();
          break;
        case 'tab': {
          if (hidden) return;
          const done = net.complete(deviceId, ed.text);
          if (done) ed.set(done);
          break;
        }
        case 'left':
          ed.left();
          break;
        case 'right':
          ed.right();
          break;
        case 'home':
          ed.home();
          break;
        case 'end':
          ed.end();
          break;
        case 'wordLeft':
          ed.wordLeft();
          break;
        case 'wordRight':
          ed.wordRight();
          break;
        case 'deleteWordBack':
          ed.deleteWordBack();
          break;
        case 'deleteWordForward':
          ed.deleteWordForward();
          break;
        case 'killToStart':
          ed.killToStart();
          break;
        case 'killToEnd':
          ed.killToEnd();
          break;
        case 'up':
          if (hidden) return;
          ed.historyPrev();
          break;
        case 'down':
          if (hidden) return;
          ed.historyNext();
          break;
        case 'abort':
          ed.take(false);
          term.write('^C\n');
          break;
        case 'end-config':
          if (!prompt().includes('(config')) return;
          ed.take(false);
          term.write('^Z');
          enter('end');
          return;
        case 'redraw':
          term.write('\n');
          break;
        case 'ignore':
          return;
      }
      render();
    };

    // Copy with Ctrl+C when text is selected (or Ctrl+Shift+C); paste with the browser.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'c' && (e.shiftKey || term.hasSelection())) {
        if (term.hasSelection()) void navigator.clipboard?.writeText(term.getSelection());
        term.clearSelection();
        e.preventDefault();
        return false;
      }
      if (mod && key === 'v') return false;
      if (e.ctrlKey && key === 'backspace') {
        e.preventDefault();
        handle({ type: 'deleteWordBack' });
        return false;
      }
      return true;
    });

    if (intro) term.write(`${intro}\n`);
    render();

    const sub = term.onData((data) => {
      for (const k of decodeKeys(data)) handle(k);
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
    // Created once per device; the parent remounts it (via key) on lab reset.
  }, []);

  useEffect(() => {
    if (active && termRef.current) {
      fitRef.current?.fit();
      termRef.current.focus();
    }
  }, [active]);

  useEffect(() => {
    if (clearSignal && active) termRef.current?.clear();
  }, [clearSignal, active]);

  return <div ref={host} className="console-host" hidden={!active} aria-label={`${deviceId} console`} />;
}
