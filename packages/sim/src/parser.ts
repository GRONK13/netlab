// A small IOS-style command parser. Commands are registered as patterns such as
// "switchport access vlan <vlan:vlan>" into a tree; input is matched token by token
// with unique-prefix abbreviation, so "sw acc vl 10" works like on real switches.

import { expandRange, parseInterfaceName } from './interfaces.ts';
import { parseVlanList } from './config.ts';

export type ParamType =
  | 'word'
  | 'vlan'
  | 'vlanlist'
  | 'line'
  | 'length'
  | 'ip'
  | 'mask'
  | 'iface'
  | 'range'
  | 'rest';

interface ParamTypeInfo {
  label: string;
  help: string;
  test: (token: string) => boolean;
}

const IP_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function isIp(s: string): boolean {
  const m = IP_RE.exec(s);
  return !!m && m.slice(1).every((o) => Number(o) <= 255);
}

export function isMask(s: string): boolean {
  if (!isIp(s)) return false;
  const n = ipToInt(s);
  // Contiguous ones followed by zeros.
  const inv = ~n >>> 0;
  return (inv & (inv + 1)) === 0;
}

export function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, o) => ((acc << 8) | Number(o)) >>> 0, 0);
}

const PARAM_TYPES: Record<ParamType, ParamTypeInfo> = {
  word: { label: 'WORD', help: '', test: (t) => t.length > 0 },
  vlan: {
    label: '<1-4094>',
    help: 'VLAN ID',
    test: (t) => /^\d+$/.test(t) && Number(t) >= 1 && Number(t) <= 4094,
  },
  vlanlist: { label: 'WORD', help: 'VLAN IDs of the allowed VLANs', test: (t) => parseVlanList(t) !== null },
  line: { label: '<0-15>', help: 'First Line number', test: (t) => /^\d+$/.test(t) && Number(t) <= 15 },
  length: {
    label: '<0-512>',
    help: 'Number of lines on screen (0 for no pausing)',
    test: (t) => /^\d+$/.test(t) && Number(t) <= 512,
  },
  ip: { label: 'A.B.C.D', help: 'IP address', test: isIp },
  mask: { label: 'A.B.C.D', help: 'IP subnet mask', test: isMask },
  iface: { label: 'WORD', help: 'Interface name, e.g. fa0/1', test: (t) => parseInterfaceName(t) !== null },
  range: { label: 'LINE', help: 'Interface range, e.g. fa0/1 - 4', test: () => true },
  rest: { label: 'LINE', help: '', test: () => true },
};

export type Handler<C> = (ctx: C, args: Record<string, string>) => string | void;

interface ParamEdge<C> {
  name: string;
  type: ParamType;
  help: string;
  node: Node<C>;
}

interface Node<C> {
  keywords: Map<string, { help: string; node: Node<C> }>;
  params: ParamEdge<C>[];
  handler?: Handler<C>;
}

function newNode<C>(): Node<C> {
  return { keywords: new Map(), params: [] };
}

export class CommandTree<C> {
  readonly root: Node<C> = newNode();
  private readonly defaults: Record<string, string>;

  /** `defaults` is `?` help text used for any keyword a pattern doesn't describe itself. */
  constructor(defaults: Record<string, string> = {}) {
    this.defaults = defaults;
  }

  /**
   * Registers a command. `pattern` words are keywords; `<name:type>` are parameters.
   * `help` maps keywords (and parameter names) to their `?` help text.
   */
  add(pattern: string, custom: Record<string, string>, handler: Handler<C>): this {
    const help = { ...this.defaults, ...custom };
    let node = this.root;
    for (const part of pattern.split(' ')) {
      const p = /^<(\w+):(\w+)>$/.exec(part);
      if (p) {
        const [, name, type] = p as unknown as [string, string, ParamType];
        let edge = node.params.find((e) => e.name === name && e.type === type);
        if (!edge) {
          edge = { name, type, help: help[name] ?? PARAM_TYPES[type].help, node: newNode() };
          node.params.push(edge);
        }
        node = edge.node;
      } else {
        const kw = part.toLowerCase();
        let entry = node.keywords.get(kw);
        if (!entry) {
          entry = { help: help[kw] ?? '', node: newNode() };
          node.keywords.set(kw, entry);
        } else if (!entry.help && help[kw]) {
          entry.help = help[kw];
        }
        node = entry.node;
      }
    }
    node.handler = handler;
    return this;
  }
}

interface Token {
  text: string;
  start: number;
}

export function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) tokens.push({ text: m[0], start: m.index });
  return tokens;
}

export type MatchResult<C> =
  | { ok: true; handler: Handler<C>; args: Record<string, string> }
  | { ok: false; error: 'invalid'; pos: number; tokenIndex: number }
  | { ok: false; error: 'ambiguous'; input: string }
  | { ok: false; error: 'incomplete' }
  | { ok: false; error: 'empty' };

interface Walk<C> {
  node: Node<C>;
  args: Record<string, string>;
  consumed: number;
}

/** Tries to consume tokens[i] (and maybe more) at `node`. */
function step<C>(
  node: Node<C>,
  line: string,
  tokens: Token[],
  i: number,
  args: Record<string, string>,
): { next: Node<C>; consumed: number } | { ambiguous: true } | null {
  const tok = tokens[i]!;
  const lower = tok.text.toLowerCase();
  const exact = node.keywords.get(lower);
  if (exact) return { next: exact.node, consumed: 1 };
  const cands = [...node.keywords.keys()].filter((k) => k.startsWith(lower));
  if (cands.length === 1) return { next: node.keywords.get(cands[0]!)!.node, consumed: 1 };
  if (cands.length > 1) return { ambiguous: true };
  for (const p of node.params) {
    if (p.type === 'rest' || p.type === 'range') {
      const text = line.slice(tok.start).trim();
      if (p.type === 'range' && expandRange(text) === null) continue;
      args[p.name] = text;
      return { next: p.node, consumed: tokens.length - i };
    }
    if (p.type === 'iface') {
      if (PARAM_TYPES.iface.test(tok.text)) {
        args[p.name] = tok.text;
        return { next: p.node, consumed: 1 };
      }
      // "fa 0/1" written with a space
      const nxt = tokens[i + 1];
      if (nxt && /^[a-z]+$/i.test(tok.text) && PARAM_TYPES.iface.test(tok.text + nxt.text)) {
        args[p.name] = tok.text + nxt.text;
        return { next: p.node, consumed: 2 };
      }
      continue;
    }
    if (PARAM_TYPES[p.type].test(tok.text)) {
      args[p.name] = tok.text;
      return { next: p.node, consumed: 1 };
    }
  }
  return null;
}

export function match<C>(tree: CommandTree<C>, line: string): MatchResult<C> {
  const tokens = tokenize(line);
  if (tokens.length === 0) return { ok: false, error: 'empty' };
  const walk: Walk<C> = { node: tree.root, args: {}, consumed: 0 };
  let i = 0;
  while (i < tokens.length) {
    const r = step(walk.node, line, tokens, i, walk.args);
    if (r === null) return { ok: false, error: 'invalid', pos: tokens[i]!.start, tokenIndex: i };
    if ('ambiguous' in r) return { ok: false, error: 'ambiguous', input: line.trim() };
    walk.node = r.next;
    i += r.consumed;
  }
  if (!walk.node.handler) return { ok: false, error: 'incomplete' };
  return { ok: true, handler: walk.node.handler, args: walk.args };
}

/** Output for `?`. `line` is everything typed before the question mark. */
export function help<C>(tree: CommandTree<C>, line: string): string {
  const tokens = tokenize(line);
  const partial = line.length > 0 && !/\s$/.test(line);
  const full = partial ? tokens.slice(0, -1) : tokens;
  let node = tree.root;
  let i = 0;
  const args: Record<string, string> = {};
  while (i < full.length) {
    const r = step(node, line, full, i, args);
    if (r === null || 'ambiguous' in r) return '% Unrecognized command';
    node = r.next;
    i += r.consumed;
  }
  if (partial) {
    const prefix = tokens[tokens.length - 1]!.text.toLowerCase();
    const words = [...node.keywords.keys()].filter((k) => k.startsWith(prefix)).sort();
    return words.length ? words.join('  ') + '  ' : '% Unrecognized command';
  }
  const rows: [string, string][] = [...node.keywords.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, v.help]);
  for (const p of node.params) rows.push([PARAM_TYPES[p.type].label, p.help]);
  if (node.handler) rows.push(['<cr>', '']);
  if (rows.length === 0) return '% Unrecognized command';
  const width = Math.max(...rows.map(([k]) => k.length));
  return rows.map(([k, h]) => `  ${k.padEnd(width)}  ${h}`.trimEnd()).join('\n');
}

/** Tab completion: returns the completed line, or null if there's no unique completion. */
export function complete<C>(tree: CommandTree<C>, line: string): string | null {
  if (line.length === 0 || /\s$/.test(line)) return null;
  const tokens = tokenize(line);
  let node = tree.root;
  let i = 0;
  const args: Record<string, string> = {};
  const head = tokens.slice(0, -1);
  while (i < head.length) {
    const r = step(node, line, head, i, args);
    if (r === null || 'ambiguous' in r) return null;
    node = r.next;
    i += r.consumed;
  }
  const last = tokens[tokens.length - 1]!;
  const prefix = last.text.toLowerCase();
  const cands = [...node.keywords.keys()].filter((k) => k.startsWith(prefix));
  if (cands.length !== 1) return null;
  return line.slice(0, last.start) + cands[0] + ' ';
}
