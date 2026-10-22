// Calendar days as 'YYYY-MM-DD' strings and day numbers (days since 1970-01-01).
// Pure UTC arithmetic: the server decides what "today" is and passes it in.

const DAY_MS = 86_400_000;

export function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / DAY_MS);
}

export function fromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday that starts the week containing day number `n`. */
export function weekStart(n: number): number {
  const weekday = new Date(n * DAY_MS).getUTCDay(); // 0 = Sunday
  return n - ((weekday + 6) % 7);
}
