/**
 * Internal lowercase Base36 primitives.
 *
 * BigInt is used for the 96-bit randomness component. JavaScript `Number`
 * cannot represent all 96-bit values exactly, so it is never used for
 * entropy arithmetic.
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ZERO = 0n;

/**
 * Map an ASCII code unit to its lowercase Base36 digit value.
 *
 * Returns `-1` for every character outside `[0-9a-z]`, including uppercase
 * letters and all non-ASCII input.
 */
export function digitValue(code: number): number {
  if (code >= 48 && code <= 57) {
    return code - 48;
  }

  if (code >= 97 && code <= 122) {
    return code - 87;
  }

  return -1;
}

/** Decode a lowercase Base36 string. Callers must validate characters first. */
export function decodeBase36(value: string): bigint {
  let result = ZERO;

  for (let index = 0; index < value.length; index += 1) {
    const digit = digitValue(value.charCodeAt(index));

    if (digit < 0) {
      throw new RangeError(`Invalid Base36 character at index ${index}.`);
    }

    result = result * 36n + BigInt(digit);
  }

  return result;
}

/**
 * Encode a non-negative integer as fixed-width, left-zero-padded lowercase
 * Base36.
 *
 * Throws if the value does not fit in `width` characters. This is an internal
 * invariant guard: public callers validate ranges before calling it.
 */
export function encodeBase36(value: bigint, width: number): string {
  if (value < ZERO) {
    throw new RangeError('Base36 value must not be negative.');
  }

  let remaining = value;
  let encoded = '';

  do {
    const digit = Number(remaining % 36n);
    encoded = ALPHABET[digit]! + encoded;
    remaining /= 36n;
  } while (remaining > ZERO);

  if (encoded.length > width) {
    throw new RangeError(`Base36 value does not fit in ${width} characters.`);
  }

  return encoded.padStart(width, '0');
}
