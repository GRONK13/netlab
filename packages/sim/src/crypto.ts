// Cosmetic password encodings for `show running-config`. Deterministic so that
// replaying a command log always produces identical output.

const TYPE7_KEY = 'dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87';

/** Cisco type 7 encoding (reversible, which is why it's weak). Fixed seed 8. */
export function type7(plain: string): string {
  const seed = 8;
  let out = seed.toString().padStart(2, '0');
  for (let i = 0; i < plain.length; i++) {
    const k = TYPE7_KEY.charCodeAt((seed + i) % TYPE7_KEY.length);
    out += (plain.charCodeAt(i) ^ k).toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

const B64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Looks like a type 5 (MD5-crypt) secret. Not a real hash; display only. */
export function type5Display(plain: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let out = '';
  for (let round = 0; out.length < 22; round++) {
    for (let i = 0; i < plain.length; i++) {
      h1 = Math.imul(h1 ^ plain.charCodeAt(i), 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ (plain.charCodeAt(i) + round), 0x85ebca6b) >>> 0;
    }
    h1 = Math.imul(h1 ^ round, 0xc2b2ae35) >>> 0;
    out += B64[h1 % 64]! + B64[h2 % 64]!;
  }
  return `$1$mERr$${out.slice(0, 22)}`;
}
