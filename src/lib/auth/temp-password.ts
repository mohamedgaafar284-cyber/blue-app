/**
 * Temporary Password Generator
 * مولّد كلمات المرور المؤقتة
 *
 * Used when an admin creates a user (or resets a user's password) WITHOUT
 * supplying a password. Previously the code silently fell back to
 * `crypto.randomUUID()` — a password that was NEVER shown to anyone and
 * never emailed, which permanently locked the new user out of the system
 * (there is no SMTP guarantee in production).
 *
 * The generated password is:
 * - Human-readable (no ambiguous chars: 0/O, 1/l/I removed)
 * - Guaranteed to satisfy PASSWORD_CONFIG (upper, lower, digit, special)
 * - 14 chars long — comfortably above the 8-char policy
 * - Returned to the admin ONCE in the API response — never stored in
 *   plaintext (only the bcrypt hash goes to the database)
 */

import { randomBytes } from 'crypto';

// Ambiguity-free alphabets (no 0/O, 1/l/I) so an admin can read the
// password aloud over the phone to an employee without confusion.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%*+-';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

const LENGTH = 14;

function randomInt(max: number): number {
  // Rejection sampling to avoid modulo bias
  const limit = Math.floor(256 / max) * max;
  let byte = 0;
  do {
    byte = randomBytes(1)[0];
  } while (byte >= limit);
  return byte % max;
}

function pick(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)];
}

export function generateTempPassword(): string {
  const chars: string[] = [
    pick(UPPER),
    pick(LOWER),
    pick(DIGITS),
    pick(SYMBOLS),
  ];
  while (chars.length < LENGTH) {
    chars.push(pick(ALL));
  }
  // Fisher–Yates shuffle with a crypto-secure RNG so the guaranteed
  // classes aren't always in the first four positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
