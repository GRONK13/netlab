/** "day" or "days" for a count. */
export const dayWord = (n: number) => (n === 1 ? 'day' : 'days');

/** A count of days, e.g. "1 day", "3 days". */
export const days = (n: number) => `${n} ${dayWord(n)}`;

/** A date as students in Manila read it, e.g. "Oct 22, 2026". */
export const dateOf = (at: string) =>
  new Date(at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
