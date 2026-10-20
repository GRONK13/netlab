import { describe, expect, it } from 'vitest';
import { decodeKeys, LineEditor } from '../src/console/lineEditor.ts';

function typed(s: string): LineEditor {
  const e = new LineEditor();
  e.insert(s);
  return e;
}

describe('LineEditor', () => {
  it('inserts at the cursor', () => {
    const e = typed('sh run');
    e.home();
    e.insert('do ');
    expect(e.text).toBe('do sh run');
    expect(e.cursor).toBe(3);
  });

  it('deletes the previous word like Ctrl+W', () => {
    const e = typed('switchport access vlan 10');
    e.deleteWordBack();
    expect(e.text).toBe('switchport access vlan ');
    e.deleteWordBack();
    expect(e.text).toBe('switchport access ');
  });

  it('moves by words and kills to either end', () => {
    const e = typed('ip address 10.0.0.1 255.0.0.0');
    e.wordLeft();
    e.wordLeft();
    expect(e.text.slice(e.cursor)).toBe('10.0.0.1 255.0.0.0');
    e.killToEnd();
    expect(e.text).toBe('ip address ');
    e.wordLeft();
    e.killToStart();
    expect(e.text).toBe('address ');
  });

  it('walks history and keeps the unfinished line', () => {
    const e = new LineEditor();
    e.insert('en');
    e.take();
    e.insert('conf t');
    e.take();
    e.insert('int f');
    e.historyPrev();
    expect(e.text).toBe('conf t');
    e.historyPrev();
    expect(e.text).toBe('en');
    e.historyNext();
    e.historyNext();
    expect(e.text).toBe('int f');
  });

  it('keeps passwords out of history', () => {
    const e = new LineEditor();
    e.insert('secret123');
    e.take(false);
    e.historyPrev();
    expect(e.text).toBe('');
  });
});

describe('decodeKeys', () => {
  it('maps control keys, arrows and Alt sequences', () => {
    const types = decodeKeys('a\x17\x1b[D\x1b[1;5C\x1bb\x1b\x7f\x15\r').map((k) => k.type);
    expect(types).toEqual([
      'char',
      'deleteWordBack',
      'left',
      'wordRight',
      'wordLeft',
      'deleteWordBack',
      'killToStart',
      'enter',
    ]);
  });

  it('treats a pasted CRLF as one Enter', () => {
    const keys = decodeKeys('en\r\nconf t\r\n');
    expect(keys.filter((k) => k.type === 'enter')).toHaveLength(2);
  });
});
