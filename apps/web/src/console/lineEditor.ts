// The input line of a device console, with the editing keys Cisco IOS (and
// most shells) support: cursor movement, word delete, kill to start/end, history.

const MAX = 300;

export class LineEditor {
  text = '';
  cursor = 0;
  private history: string[] = [];
  private hIdx = 0;
  private draft = '';

  insert(s: string): void {
    const room = MAX - this.text.length;
    if (room <= 0) return;
    s = s.slice(0, room);
    this.text = this.text.slice(0, this.cursor) + s + this.text.slice(this.cursor);
    this.cursor += s.length;
  }

  /** Replaces the whole line (Tab completion, history). */
  set(s: string): void {
    this.text = s.slice(0, MAX);
    this.cursor = this.text.length;
  }

  backspace(): void {
    if (this.cursor === 0) return;
    this.text = this.text.slice(0, this.cursor - 1) + this.text.slice(this.cursor);
    this.cursor--;
  }

  deleteChar(): void {
    this.text = this.text.slice(0, this.cursor) + this.text.slice(this.cursor + 1);
  }

  left(): void {
    this.cursor = Math.max(0, this.cursor - 1);
  }

  right(): void {
    this.cursor = Math.min(this.text.length, this.cursor + 1);
  }

  home(): void {
    this.cursor = 0;
  }

  end(): void {
    this.cursor = this.text.length;
  }

  private wordStart(): number {
    let i = this.cursor;
    while (i > 0 && this.text[i - 1] === ' ') i--;
    while (i > 0 && this.text[i - 1] !== ' ') i--;
    return i;
  }

  private wordEnd(): number {
    let i = this.cursor;
    while (i < this.text.length && this.text[i] === ' ') i++;
    while (i < this.text.length && this.text[i] !== ' ') i++;
    return i;
  }

  wordLeft(): void {
    this.cursor = this.wordStart();
  }

  wordRight(): void {
    this.cursor = this.wordEnd();
  }

  /** Ctrl+W: delete the word before the cursor. */
  deleteWordBack(): void {
    const start = this.wordStart();
    this.text = this.text.slice(0, start) + this.text.slice(this.cursor);
    this.cursor = start;
  }

  /** Esc D: delete the word after the cursor. */
  deleteWordForward(): void {
    this.text = this.text.slice(0, this.cursor) + this.text.slice(this.wordEnd());
  }

  /** Ctrl+U / Ctrl+X: delete from the start of the line to the cursor. */
  killToStart(): void {
    this.text = this.text.slice(this.cursor);
    this.cursor = 0;
  }

  /** Ctrl+K: delete from the cursor to the end of the line. */
  killToEnd(): void {
    this.text = this.text.slice(0, this.cursor);
  }

  historyPrev(): void {
    if (this.hIdx === 0) return;
    if (this.hIdx === this.history.length) this.draft = this.text;
    this.hIdx--;
    this.set(this.history[this.hIdx]!);
  }

  historyNext(): void {
    if (this.hIdx >= this.history.length) return;
    this.hIdx++;
    this.set(this.hIdx === this.history.length ? this.draft : this.history[this.hIdx]!);
  }

  /** Returns the line and clears it. Non-secret, non-blank lines go into history. */
  take(remember = true): string {
    const line = this.text;
    if (remember && line.trim() && this.history[this.history.length - 1] !== line) {
      this.history.push(line);
      if (this.history.length > 100) this.history.shift();
    }
    this.hIdx = this.history.length;
    this.draft = '';
    this.text = '';
    this.cursor = 0;
    return line;
  }
}

/** A decoded keystroke from the terminal's input stream. */
export type Key =
  | { type: 'char'; ch: string }
  | { type: 'enter' }
  | { type: 'backspace' }
  | { type: 'delete' }
  | { type: 'tab' }
  | { type: 'left' }
  | { type: 'right' }
  | { type: 'up' }
  | { type: 'down' }
  | { type: 'home' }
  | { type: 'end' }
  | { type: 'wordLeft' }
  | { type: 'wordRight' }
  | { type: 'deleteWordBack' }
  | { type: 'deleteWordForward' }
  | { type: 'killToStart' }
  | { type: 'killToEnd' }
  | { type: 'abort' }
  | { type: 'end-config' }
  | { type: 'redraw' }
  | { type: 'ignore' };

const CTRL: Record<string, Key['type']> = {
  '\x01': 'home', // Ctrl+A
  '\x02': 'left', // Ctrl+B
  '\x03': 'abort', // Ctrl+C
  '\x04': 'delete', // Ctrl+D
  '\x05': 'end', // Ctrl+E
  '\x06': 'right', // Ctrl+F
  '\x08': 'deleteWordBack', // Ctrl+Backspace
  '\t': 'tab',
  '\x0b': 'killToEnd', // Ctrl+K
  '\x0c': 'redraw', // Ctrl+L
  '\r': 'enter',
  '\n': 'enter',
  '\x0e': 'down', // Ctrl+N
  '\x10': 'up', // Ctrl+P
  '\x15': 'killToStart', // Ctrl+U
  '\x17': 'deleteWordBack', // Ctrl+W
  '\x18': 'killToStart', // Ctrl+X
  '\x1a': 'end-config', // Ctrl+Z
  '\x7f': 'backspace',
};

const CSI: Record<string, Key['type']> = {
  A: 'up',
  B: 'down',
  C: 'right',
  D: 'left',
  H: 'home',
  F: 'end',
  '1~': 'home',
  '7~': 'home',
  '4~': 'end',
  '8~': 'end',
  '3~': 'delete',
  '1;5C': 'wordRight',
  '1;5D': 'wordLeft',
  '1;3C': 'wordRight',
  '1;3D': 'wordLeft',
};

const ALT: Record<string, Key['type']> = {
  b: 'wordLeft',
  f: 'wordRight',
  d: 'deleteWordForward',
  '\x7f': 'deleteWordBack', // Alt+Backspace
};

/** Splits terminal input (keystrokes or a paste) into keys. */
export function decodeKeys(data: string): Key[] {
  const keys: Key[] = [];
  for (let i = 0; i < data.length; i++) {
    const ch = data[i]!;
    if (ch === '\x1b') {
      const next = data[i + 1];
      if (next === '[' || next === 'O') {
        const m = /^[\d;]*[A-Za-z~]/.exec(data.slice(i + 2));
        if (m) {
          keys.push({ type: CSI[m[0]] ?? 'ignore' } as Key);
          i += 1 + m[0].length;
          continue;
        }
      }
      if (next !== undefined && ALT[next]) {
        keys.push({ type: ALT[next] } as Key);
        i++;
        continue;
      }
      keys.push({ type: 'ignore' });
      continue;
    }
    // A pasted "\r\n" is a single Enter.
    if (ch === '\n' && data[i - 1] === '\r') continue;
    const ctrl = CTRL[ch];
    if (ctrl) keys.push({ type: ctrl } as Key);
    else if (ch >= ' ') keys.push({ type: 'char', ch });
    else keys.push({ type: 'ignore' });
  }
  return keys;
}
