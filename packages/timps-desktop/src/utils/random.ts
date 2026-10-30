/**
 * Cryptographic randomness helpers for the desktop app.
 *
 * `Math.random()` is not suitable for secrets (TOTP seeds, generated
 * passwords, session ids): its stream can be predicted from earlier output.
 * These wrap the platform CSPRNG (`crypto.getRandomValues`, available in
 * browsers and Node) and reject the biased tail of the value range.
 */

/** Uniform random integer in [0, maxExclusive). */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError('maxExclusive must be a positive integer');
  }
  // Discard values above the largest multiple of maxExclusive so the modulo
  // below cannot favour the low entries of the alphabet.
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % maxExclusive;
  }
}

/** A random string of `length` characters drawn uniformly from `alphabet`. */
export function secureRandomString(length: number, alphabet: string): string {
  if (!alphabet.length) throw new RangeError('alphabet must not be empty');
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[secureRandomInt(alphabet.length)];
  }
  return out;
}
