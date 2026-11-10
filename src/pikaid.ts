/**
 * The pikaid value type and public operations.
 *
 * A pikaid is 26 lowercase Base36 characters: a 7-character unsigned Unix
 * timestamp followed by 19 characters encoding exactly 96 bits of
 * cryptographic randomness. Its binary representation is exactly 17 bytes:
 * five big-endian timestamp bytes followed by the twelve randomness bytes.
 */

import { decodeBase36, encodeBase36 } from './base36.js';
import {
  bigintToBytes,
  bytesToBigInt,
  bytesToHex,
} from './bytes.js';
import {
  BINARY_LENGTH,
  ID_LENGTH,
  MAX_RANDOMNESS,
  MAX_TIMESTAMP,
  RANDOMNESS_BYTES,
  RANDOMNESS_CHARS,
  TIMESTAMP_BYTES,
  TIMESTAMP_CHARS,
} from './constants.js';
import { describeValue, PikaidError } from './errors.js';
import { randomBytes } from './random.js';

interface DecodedPikaid {
  readonly id: string;
  readonly timestamp: number;
  readonly randomness: Uint8Array;
}

/**
 * Private construction token. It keeps the public API to the documented
 * factories even for JavaScript callers, where TypeScript's `private`
 * modifier has no runtime effect.
 */
const CONSTRUCTOR_TOKEN: unique symbol = Symbol('pikaid.constructor');

/** Comparison result returned by {@link compare} and {@link Pikaid.compare}. */
export type PikaidComparison = -1 | 0 | 1;

/** A pikaid in any of its supported representations. */
export type PikaidLike = Pikaid | string | Uint8Array;

function asString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new PikaidError(
      'INVALID_TYPE',
      `Expected a pikaid string, received ${describeValue(value)}.`,
    );
  }

  return value;
}

function assertShape(value: string): void {
  if (value.length !== ID_LENGTH) {
    throw new PikaidError(
      'INVALID_LENGTH',
      `A pikaid string must be exactly ${ID_LENGTH} characters; received ${value.length}.`,
    );
  }

  for (let index = 0; index < ID_LENGTH; index += 1) {
    const code = value.charCodeAt(index);
    const isDigit = code >= 48 && code <= 57;
    const isLowercaseLetter = code >= 97 && code <= 122;

    if (!isDigit && !isLowercaseLetter) {
      throw new PikaidError(
        'INVALID_CHARACTER',
        `Invalid character at index ${index}; expected lowercase Base36 [0-9a-z].`,
      );
    }
  }
}

function assertTimestamp(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_TIMESTAMP
  ) {
    throw new PikaidError(
      'TIMESTAMP_OUT_OF_RANGE',
      `Timestamp must be an integer between 0 and ${MAX_TIMESTAMP} (inclusive); received ${describeValue(value)}.`,
    );
  }

  // Normalize negative zero so the decoded timestamp is always canonical.
  return value === 0 ? 0 : value;
}

function assertRandomness(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new PikaidError(
      'INVALID_TYPE',
      `Expected randomness as a Uint8Array, received ${describeValue(value)}.`,
    );
  }

  if (value.byteLength !== RANDOMNESS_BYTES) {
    throw new PikaidError(
      'INVALID_RANDOMNESS_LENGTH',
      `Randomness must be exactly ${RANDOMNESS_BYTES} bytes; received ${value.byteLength}.`,
    );
  }

  return new Uint8Array(value);
}

function writeTimestamp(bytes: Uint8Array, timestamp: number): void {
  bytes[0] = Math.floor(timestamp / 0x1_0000_0000);
  let remainder = timestamp % 0x1_0000_0000;

  bytes[1] = Math.floor(remainder / 0x1_000_000);
  remainder %= 0x1_000_000;
  bytes[2] = Math.floor(remainder / 0x1_0000);
  remainder %= 0x1_0000;
  bytes[3] = Math.floor(remainder / 0x100);
  bytes[4] = remainder % 0x100;
}

function readTimestamp(bytes: Uint8Array): number {
  return (
    bytes[0]! * 0x1_0000_0000 +
    bytes[1]! * 0x1_000_000 +
    bytes[2]! * 0x1_0000 +
    bytes[3]! * 0x100 +
    bytes[4]!
  );
}

function encodeString(timestamp: number, randomness: Uint8Array): string {
  const timestampPart = encodeBase36(BigInt(timestamp), TIMESTAMP_CHARS);
  const randomnessPart = encodeBase36(bytesToBigInt(randomness), RANDOMNESS_CHARS);

  return timestampPart + randomnessPart;
}

function encodeBinary(timestamp: number, randomness: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(BINARY_LENGTH);
  writeTimestamp(bytes, timestamp);
  bytes.set(randomness, TIMESTAMP_BYTES);

  return bytes;
}

function decodeString(value: unknown): DecodedPikaid {
  const id = asString(value);
  assertShape(id);

  const timestamp = Number(decodeBase36(id.slice(0, TIMESTAMP_CHARS)));

  if (timestamp > MAX_TIMESTAMP) {
    throw new PikaidError(
      'TIMESTAMP_OVERFLOW',
      `Timestamp exceeds the pikaid maximum of ${MAX_TIMESTAMP}.`,
    );
  }

  const randomnessValue = decodeBase36(id.slice(TIMESTAMP_CHARS));

  if (randomnessValue > MAX_RANDOMNESS) {
    throw new PikaidError(
      'RANDOMNESS_OVERFLOW',
      'Randomness exceeds 96 bits; nineteen Base36 characters can encode values above the pikaid limit.',
    );
  }

  return {
    id,
    timestamp,
    randomness: bigintToBytes(randomnessValue, RANDOMNESS_BYTES),
  };
}

function decodeBinary(value: unknown): DecodedPikaid {
  if (!(value instanceof Uint8Array)) {
    throw new PikaidError(
      'INVALID_TYPE',
      `Expected pikaid binary data as a Uint8Array, received ${describeValue(value)}.`,
    );
  }

  if (value.byteLength !== BINARY_LENGTH) {
    throw new PikaidError(
      'INVALID_LENGTH',
      `Pikaid binary data must be exactly ${BINARY_LENGTH} bytes; received ${value.byteLength}.`,
    );
  }

  const timestamp = readTimestamp(value);

  if (timestamp > MAX_TIMESTAMP) {
    throw new PikaidError(
      'TIMESTAMP_OVERFLOW',
      `Binary timestamp exceeds the pikaid maximum of ${MAX_TIMESTAMP}.`,
    );
  }

  const randomness = new Uint8Array(value.subarray(TIMESTAMP_BYTES));

  return {
    id: encodeString(timestamp, randomness),
    timestamp,
    randomness,
  };
}

function currentTimestamp(): number {
  const timestamp = Math.floor(Date.now() / 1000);

  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp < 0 ||
    timestamp > MAX_TIMESTAMP
  ) {
    throw new PikaidError(
      'TIMESTAMP_OUT_OF_RANGE',
      `System clock timestamp ${timestamp} is outside the pikaid range 0..${MAX_TIMESTAMP}.`,
    );
  }

  return timestamp;
}

function generateDecoded(timestamp: number): DecodedPikaid {
  const randomness = randomBytes(RANDOMNESS_BYTES);

  return {
    id: encodeString(timestamp, randomness),
    timestamp,
    randomness,
  };
}

/**
 * An immutable, parsed pikaid value.
 *
 * Use {@link parse}, {@link Pikaid.parse}, or {@link Pikaid.fromBinary} to
 * obtain an instance. All accessors and conversions validate or preserve the
 * format; the randomness accessor returns a defensive copy.
 */
export class Pikaid {
  readonly #id: string;
  readonly #timestamp: number;
  readonly #randomness: Uint8Array;
  readonly #randomnessHex: string;

  private constructor(decoded: DecodedPikaid, token: symbol) {
    if (token !== CONSTRUCTOR_TOKEN) {
      throw new PikaidError(
        'INVALID_TYPE',
        'Pikaid values must be created with parse(), fromBinary(), fromParts(), or a generate function.',
      );
    }

    this.#id = decoded.id;
    this.#timestamp = decoded.timestamp;
    this.#randomness = decoded.randomness;
    this.#randomnessHex = bytesToHex(decoded.randomness);
  }

  /** Generate a pikaid from the current UTC Unix time and a CSPRNG. */
  static generate(): Pikaid {
    return new Pikaid(generateDecoded(currentTimestamp()), CONSTRUCTOR_TOKEN);
  }

  /**
   * Generate a pikaid at an explicit whole-second Unix timestamp.
   *
   * Randomness still comes from the platform CSPRNG.
   */
  static generateAt(timestamp: number): Pikaid {
    return new Pikaid(generateDecoded(assertTimestamp(timestamp)), CONSTRUCTOR_TOKEN);
  }

  /**
   * Construct a pikaid from an explicit timestamp and twelve randomness bytes.
   *
   * The caller is responsible for supplying uniformly distributed,
   * cryptographically secure randomness. The input is copied.
   */
  static fromParts(timestamp: number, randomness: Uint8Array): Pikaid {
    const validTimestamp = assertTimestamp(timestamp);
    const validRandomness = assertRandomness(randomness);

    return new Pikaid(
      {
        id: encodeString(validTimestamp, validRandomness),
        timestamp: validTimestamp,
        randomness: validRandomness,
      },
      CONSTRUCTOR_TOKEN,
    );
  }

  /** Strictly parse a pikaid string. Throws {@link PikaidError} on invalid input. */
  static parse(value: unknown): Pikaid {
    return new Pikaid(decodeString(value), CONSTRUCTOR_TOKEN);
  }

  /** Strictly decode a 17-byte pikaid binary value. */
  static fromBinary(value: Uint8Array): Pikaid {
    return new Pikaid(decodeBinary(value), CONSTRUCTOR_TOKEN);
  }

  /** Compare two pikaids in any supported representation. */
  static compare(left: PikaidLike, right: PikaidLike): PikaidComparison {
    return compare(left, right);
  }

  /** The canonical 26-character string form. */
  get id(): string {
    return this.#id;
  }

  /** The Unix timestamp in whole seconds. */
  get timestamp(): number {
    return this.#timestamp;
  }

  /** A copy of the twelve randomness bytes. */
  get randomness(): Uint8Array {
    return new Uint8Array(this.#randomness);
  }

  /** The randomness as 24 lowercase hexadecimal characters. */
  get randomnessHex(): string {
    return this.#randomnessHex;
  }

  /** The 17-byte binary representation. */
  toBinary(): Uint8Array {
    return encodeBinary(this.#timestamp, this.#randomness);
  }

  /** The canonical string form. */
  toString(): string {
    return this.#id;
  }

  /** JSON serialization uses the canonical string form. */
  toJSON(): string {
    return this.#id;
  }

  /** Compare this value with another pikaid in any supported representation. */
  compare(other: PikaidLike): PikaidComparison {
    return compare(this, other);
  }

  /** Whether another pikaid represents the same value. */
  equals(other: PikaidLike): boolean {
    return compare(this, other) === 0;
  }
}

/**
 * Generate a pikaid string from the current UTC Unix time and a CSPRNG.
 *
 * The timestamp has one-second precision. Generated values within the same
 * second are not ordered by generation time; sort by the full identifier when
 * chronological order at second granularity is required.
 */
export function generate(): string {
  return generateDecoded(currentTimestamp()).id;
}

/**
 * Generate a pikaid string at an explicit whole-second Unix timestamp.
 *
 * @throws {PikaidError} `TIMESTAMP_OUT_OF_RANGE` for non-integers, negative
 * values, or values above {@link MAX_TIMESTAMP}.
 */
export function generateAt(timestamp: number): string {
  return generateDecoded(assertTimestamp(timestamp)).id;
}

/** Generate a 17-byte binary pikaid from the current UTC Unix time. */
export function generateBinary(): Uint8Array {
  const decoded = generateDecoded(currentTimestamp());
  return encodeBinary(decoded.timestamp, decoded.randomness);
}

/** Generate a 17-byte binary pikaid at an explicit whole-second timestamp. */
export function generateBinaryAt(timestamp: number): Uint8Array {
  const decoded = generateDecoded(assertTimestamp(timestamp));
  return encodeBinary(decoded.timestamp, decoded.randomness);
}

/**
 * Encode a pikaid from an explicit timestamp and twelve randomness bytes.
 *
 * This is a deterministic, lossless conversion. It does not obtain randomness
 * itself; production generation should use {@link generate} or
 * {@link generateAt}. The input randomness is copied.
 */
export function fromParts(timestamp: number, randomness: Uint8Array): string {
  return Pikaid.fromParts(timestamp, randomness).id;
}

/**
 * Strictly parse a pikaid string into a {@link Pikaid} value.
 *
 * @throws {PikaidError} for non-strings, wrong lengths, invalid characters,
 * or randomness above 96 bits.
 */
export function parse(value: unknown): Pikaid {
  return Pikaid.parse(value);
}

/**
 * Return `true` only for fully valid pikaid strings.
 *
 * This checks the exact length, the lowercase Base36 alphabet, and the 96-bit
 * randomness bound. It does not throw.
 */
export function isValid(value: unknown): value is string {
  try {
    decodeString(value);
    return true;
  } catch (error) {
    if (error instanceof PikaidError) {
      return false;
    }

    throw error;
  }
}

/**
 * Return `true` when a value has the pikaid shape: exactly 26 lowercase Base36
 * characters.
 *
 * This is a well-formedness check only. It does not check the 96-bit
 * randomness bound, so `isWellFormed(id) === true` does not imply
 * `isValid(id) === true`. Use {@link isValid} for full validation.
 */
export function isWellFormed(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== ID_LENGTH) {
    return false;
  }

  for (let index = 0; index < ID_LENGTH; index += 1) {
    const code = value.charCodeAt(index);
    const isDigit = code >= 48 && code <= 57;
    const isLowercaseLetter = code >= 97 && code <= 122;

    if (!isDigit && !isLowercaseLetter) {
      return false;
    }
  }

  return true;
}

/** Convert a pikaid string to exactly 17 binary bytes. */
export function toBinary(value: string): Uint8Array {
  const decoded = decodeString(value);
  return encodeBinary(decoded.timestamp, decoded.randomness);
}

/** Convert exactly 17 binary bytes to the canonical pikaid string. */
export function fromBinary(value: Uint8Array): string {
  return decodeBinary(value).id;
}

/** Extract the whole-second Unix timestamp from a pikaid string. */
export function timestampOf(value: string): number {
  return decodeString(value).timestamp;
}

/** Extract a copy of the twelve randomness bytes from a pikaid string. */
export function randomnessOf(value: string): Uint8Array {
  return decodeString(value).randomness;
}

function comparableBytes(value: PikaidLike): Uint8Array {
  if (value instanceof Pikaid) {
    return value.toBinary();
  }

  if (typeof value === 'string') {
    return toBinary(value);
  }

  if (value instanceof Uint8Array) {
    // Validate the binary value before allowing it into an ordering operation.
    decodeBinary(value);
    return new Uint8Array(value);
  }

  throw new PikaidError(
    'INVALID_TYPE',
    `Expected a pikaid string, Pikaid, or 17-byte Uint8Array; received ${describeValue(value)}.`,
  );
}

/**
 * Compare two pikaids by unsigned bytewise order.
 *
 * String comparison is ASCII-compatible lexicographic order; binary comparison
 * is unsigned bytewise order. Values with different timestamps sort
 * chronologically. Values with the same timestamp sort by randomness, not by
 * generation time. Mixed representations are compared through their binary
 * form, so `compare(id, toBinary(id)) === 0`.
 *
 * @throws {PikaidError} if either argument is not a valid pikaid.
 */
export function compare(left: PikaidLike, right: PikaidLike): PikaidComparison {
  const leftBytes = comparableBytes(left);
  const rightBytes = comparableBytes(right);

  for (let index = 0; index < BINARY_LENGTH; index += 1) {
    const leftByte = leftBytes[index]!;
    const rightByte = rightBytes[index]!;

    if (leftByte !== rightByte) {
      return leftByte < rightByte ? -1 : 1;
    }
  }

  return 0;
}
