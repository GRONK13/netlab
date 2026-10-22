/** "day" or "days" for a count. */
export const dayWord = (n: number) => (n === 1 ? 'day' : 'days');

/** A count of days, e.g. "1 day", "3 days". */
export const days = (n: number) => `${n} ${dayWord(n)}`;
