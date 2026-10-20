export const MAX_HINTS = 3;
export const HINT_PENALTY = 0.1;

export const LEVELS = [
  { level: 1, xp: 0, rank: 'Cable Runner' },
  { level: 2, xp: 100, rank: 'Patch Panel Pro' },
  { level: 3, xp: 250, rank: 'Switch Tech' },
  { level: 4, xp: 450, rank: 'VLAN Wrangler' },
  { level: 5, xp: 700, rank: 'Router Jockey' },
  { level: 6, xp: 1000, rank: 'Network Engineer' },
  { level: 7, xp: 1400, rank: 'Senior Network Engineer' },
  { level: 8, xp: 1900, rank: 'Network Architect' },
  { level: 9, xp: 2500, rank: 'CCNA Ready' },
] as const;

export interface LevelInfo {
  level: number;
  rank: string;
  xp: number;
  /** XP where the current level started. */
  floor: number;
  /** XP needed for the next level, or null at max level. */
  next: number | null;
  /** 0..1 progress toward the next level. */
  progress: number;
}

export function levelFor(xp: number): LevelInfo {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1]!.xp) i++;
  const cur = LEVELS[i]!;
  const nxt = LEVELS[i + 1];
  return {
    level: cur.level,
    rank: cur.rank,
    xp,
    floor: cur.xp,
    next: nxt ? nxt.xp : null,
    progress: nxt ? (xp - cur.xp) / (nxt.xp - cur.xp) : 1,
  };
}

/** XP for finishing a lab after using `hints` hints. */
export function xpAward(labXp: number, hints: number): number {
  const used = Math.min(Math.max(hints, 0), MAX_HINTS);
  return Math.round(labXp * (1 - HINT_PENALTY * used));
}
