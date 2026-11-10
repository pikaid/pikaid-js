/**
 * Internal byte and hexadecimal helpers.
 */

const HEX = '0123456789abcdef';

/** Interpret bytes as an unsigned big-endian integer. */
export function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;

  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }

  return value;
}

/**
 * Encode an unsigned integer as exactly `length` big-endian bytes.
 *
 * Throws if the value does not fit. This is an internal invariant guard.
 */
export function bigintToBytes(value: bigint, length: number): Uint8Array {
  if (value < 0n) {
    throw new RangeError('Byte value must not be negative.');
  }

  const bytes = new Uint8Array(length);
  let remaining = value;

  for (let index = length - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  if (remaining !== 0n) {
    throw new RangeError(`Value does not fit in ${length} bytes.`);
  }

  return bytes;
}

/** Encode bytes as lowercase hexadecimal. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';

  for (const byte of bytes) {
    hex += HEX[byte >> 4]! + HEX[byte & 0x0f]!;
  }

  return hex;
}
