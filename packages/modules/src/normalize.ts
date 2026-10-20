import { intToIp, ipToInt, isIp } from '@netlab/sim';

/** Same address, allowing spaces and leading zeros (010.004.009.064). */
export function sameIp(given: string, expected: string): boolean {
  const s = given.trim();
  return isIp(s) && intToIp(ipToInt(s)) === expected;
}

/** Same number, allowing "/26" for prefixes and "4,094" or "4 094" for counts. */
export function sameNumber(given: string, expected: string): boolean {
  const n = given.trim().replace(/^\//, '').replace(/[\s,]/g, '');
  return /^\d+$/.test(n) && Number(n) === Number(expected);
}
