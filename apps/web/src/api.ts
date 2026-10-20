import type { LevelInfo } from '@netlab/labs';
import type { LogEntry } from '@netlab/sim';

export interface User {
  id: number;
  email: string;
  displayName: string;
  role: 'student' | 'instructor';
}

export interface Me {
  user: User;
  level: LevelInfo;
  completions: { labId: string; xpAwarded: number; completedAt: string }[];
}

export interface Attempt {
  log: LogEntry[];
  hintsUsed: number;
  completed: boolean;
}

export interface SubmitResult {
  passed: boolean;
  results: boolean[];
  xpAwarded: number;
  alreadyCompleted: boolean;
  level: LevelInfo;
}

export interface Leaderboard {
  totalLabs: number;
  entries: { place: number; displayName: string; xp: number; labs: number; level: number; rank: string }[];
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(method: string, url: string, body?: unknown, keepalive = false): Promise<T> {
  const write = method !== 'GET';
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    keepalive,
    headers: write ? { 'content-type': 'application/json' } : undefined,
    // The server only accepts JSON for writes (CSRF protection), so always send a body.
    body: write ? JSON.stringify(body ?? {}) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  me: () => call<Me>('GET', '/api/me'),
  register: (email: string, password: string, displayName: string) =>
    call<{ user: User }>('POST', '/api/auth/register', { email, password, displayName }),
  login: (email: string, password: string) => call<{ user: User }>('POST', '/api/auth/login', { email, password }),
  logout: () => call<void>('POST', '/api/auth/logout'),
  attempt: (labId: string) => call<Attempt>('GET', `/api/labs/${labId}/attempt`),
  saveAttempt: (labId: string, log: LogEntry[], keepalive = false) =>
    call<void>('PUT', `/api/labs/${labId}/attempt`, { log }, keepalive),
  hint: (labId: string) => call<{ hintsUsed: number }>('POST', `/api/labs/${labId}/hint`),
  submit: (labId: string, log: LogEntry[]) => call<SubmitResult>('POST', `/api/labs/${labId}/submit`, { log }),
  leaderboard: () => call<Leaderboard>('GET', '/api/leaderboard'),
};
