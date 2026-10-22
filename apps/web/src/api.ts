import type { LevelInfo } from '@netlab/labs';
import type { Problem, Question, Streak, TrainerSpec, Week } from '@netlab/modules';
import type { LogEntry, NetworkSnapshot } from '@netlab/sim';

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
  moduleSteps: { moduleId: string; step: 'lesson' | 'trainer' | 'quiz'; xpAwarded: number; completedAt: string }[];
  progress: { today: string; streak: Streak; week: Week; badges: { id: string; earnedAt: string }[] };
}

export interface Providers {
  providers: { id: string; label: string }[];
  emailSignup: boolean;
}

export interface PendingSignup {
  email: string;
  suggestedName: string;
  provider: string;
}

export interface QuizStart {
  attemptId: number;
  questions: Question[];
  pass: number;
}

export interface QuizResult {
  correct: number;
  total: number;
  passed: boolean;
  results: boolean[];
  xpAwarded: number;
  /** Only after a pass. */
  review: { id: string; answer: string; explanation: string }[] | null;
  level: LevelInfo;
  newBadges: string[];
}

export interface TrainerBest {
  correct: number;
  durationMs: number;
}

export interface TrainerInfo {
  spec: TrainerSpec;
  best: TrainerBest | null;
  earned: boolean;
}

export interface TrainerResult {
  correct: number;
  total: number;
  results: boolean[];
  answers: string[];
  durationMs: number;
  qualified: boolean;
  xpAwarded: number;
  best: TrainerBest | null;
  level: LevelInfo;
  newBadges: string[];
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
  newBadges: string[];
}

export interface Leaderboard {
  totalLabs: number;
  entries: {
    place: number;
    displayName: string;
    xp: number;
    labs: number;
    streak: number;
    badges: number;
    level: number;
    rank: string;
  }[];
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
  providers: () => call<Providers>('GET', '/api/auth/providers'),
  pendingSignup: () => call<PendingSignup>('GET', '/api/auth/pending'),
  completeSignup: (displayName: string) => call<{ user: User }>('POST', '/api/auth/complete', { displayName }),
  attempt: (labId: string) => call<Attempt>('GET', `/api/labs/${labId}/attempt`),
  saveAttempt: (labId: string, log: LogEntry[], keepalive = false) =>
    call<void>('PUT', `/api/labs/${labId}/attempt`, { log }, keepalive),
  hint: (labId: string) => call<{ hintsUsed: number }>('POST', `/api/labs/${labId}/hint`),
  submit: (labId: string, log: LogEntry[]) => call<SubmitResult>('POST', `/api/labs/${labId}/submit`, { log }),
  leaderboard: () => call<Leaderboard>('GET', '/api/leaderboard'),
  sandbox: () => call<{ snapshot: NetworkSnapshot | null }>('GET', '/api/sandbox'),
  saveSandbox: (snapshot: NetworkSnapshot, keepalive = false) =>
    call<void>('PUT', '/api/sandbox', { snapshot }, keepalive),
  trainer: (kind: string) => call<TrainerInfo>('GET', `/api/trainer/${kind}`),
  startRound: (kind: string) => call<{ roundId: number; problems: Problem[] }>('POST', `/api/trainer/${kind}/start`),
  finishRound: (roundId: number, answers: string[]) =>
    call<TrainerResult>('POST', `/api/trainer/rounds/${roundId}/finish`, { answers }),
  lessonDone: (moduleId: string) => call<{ newBadges: string[] }>('POST', `/api/modules/${moduleId}/lesson`),
  startQuiz: (moduleId: string) => call<QuizStart>('POST', `/api/modules/${moduleId}/quiz`),
  submitQuiz: (attemptId: number, answers: string[]) =>
    call<QuizResult>('POST', `/api/quiz/${attemptId}/submit`, { answers }),
  setGoal: (days: number) => call<{ week: Week }>('PUT', '/api/me/goal', { days }),
};
