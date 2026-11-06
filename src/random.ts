/**
 * Cryptographic randomness acquisition.
 *
 * The implementation uses the Web Cryptography API
 * (`globalThis.crypto.getRandomValues`), which is provided by Node.js and by
 * browsers. It never falls back to a non-cryptographic source: if the platform
 * CSPRNG is missing or fails, generation fails closed.
 */

import { RANDOMNESS_BYTES } from './constants.js';
import { PikaidError } from './errors.js';

interface WebCryptoLike {
  getRandomValues(array: Uint8Array): Uint8Array;
}

/**
 * Return exactly twelve independent bytes from the platform CSPRNG.
 *
 * @throws {PikaidError} `CRYPTO_UNAVAILABLE` when no Web Crypto CSPRNG is
 * present, or `CRYPTO_FAILURE` when the CSPRNG throws.
 */
export function randomBytes(length: number = RANDOMNESS_BYTES): Uint8Array {
  const crypto = (globalThis as { crypto?: WebCryptoLike | null }).crypto;

  if (
    crypto === undefined ||
    crypto === null ||
    typeof crypto.getRandomValues !== 'function'
  ) {
    throw new PikaidError(
      'CRYPTO_UNAVAILABLE',
      'A cryptographically secure random number generator is required: globalThis.crypto.getRandomValues is unavailable.',
    );
  }

  const bytes = new Uint8Array(length);

  try {
    crypto.getRandomValues(bytes);
  } catch (cause) {
    throw new PikaidError(
      'CRYPTO_FAILURE',
      'The platform cryptographically secure random number generator failed.',
      { cause },
    );
  }

  return bytes;
}
