/**
 * Compile-time contract tests for the emitted declarations.
 *
 * This file is type-checked only (`npm run typecheck:types`); it is never run.
 */
import {
  BINARY_LENGTH,
  ID_LENGTH,
  MAX_RANDOMNESS,
  MAX_TIMESTAMP,
  Pikaid,
  PikaidError,
  RANDOMNESS_BYTES,
  RANDOMNESS_CHARS,
  TIMESTAMP_BYTES,
  TIMESTAMP_CHARS,
  compare,
  fromBinary,
  fromParts,
  generate,
  generateAt,
  generateBinary,
  generateBinaryAt,
  isWellFormed,
  isValid,
  parse,
  randomnessOf,
  timestampOf,
  toBinary,
  type PikaidComparison,
  type PikaidErrorCode,
  type PikaidLike,
} from 'pikaid';

const id: string = generate();
const generatedAt: string = generateAt(1_700_000_000);
const binary: Uint8Array = generateBinary();
const binaryAt: Uint8Array = generateBinaryAt(1_700_000_000);
const composed: string = fromParts(1, new Uint8Array(12));
const value: Pikaid = parse(id);
const parsedBinary: Pikaid = Pikaid.fromBinary(binary);
const timestamp: number = timestampOf(id);
const entropy: Uint8Array = randomnessOf(id);
const bytes: Uint8Array = toBinary(id);
const restored: string = fromBinary(bytes);
const comparison: PikaidComparison = compare(id, binary);
const compared: PikaidComparison = value.compare(restored);
const same: boolean = value.equals(restored);
const errorCode: PikaidErrorCode = 'CRYPTO_FAILURE';
const error: PikaidError = new PikaidError(errorCode, 'message');
const like: PikaidLike[] = [value, id, binary];

const constants: readonly [number, number, number, number, number, number, number] = [
  ID_LENGTH,
  TIMESTAMP_CHARS,
  RANDOMNESS_CHARS,
  BINARY_LENGTH,
  TIMESTAMP_BYTES,
  RANDOMNESS_BYTES,
  MAX_TIMESTAMP,
];
const maximumRandomness: bigint = MAX_RANDOMNESS;

function narrow(value: unknown): string | undefined {
  if (isValid(value)) {
    const valid: string = value;
    return valid;
  }

  if (isWellFormed(value)) {
    const wellFormed: string = value;
    return wellFormed;
  }

  return undefined;
}

void [
  generatedAt,
  binaryAt,
  composed,
  parsedBinary,
  timestamp,
  entropy,
  comparison,
  compared,
  same,
  error,
  like,
  constants,
  maximumRandomness,
  narrow,
];

// @ts-expect-error a timestamp must be a number
generateAt('1700000000');

// @ts-expect-error toBinary accepts only the string form
toBinary(123);

// @ts-expect-error fromBinary accepts only a Uint8Array
fromBinary([0, 1, 2]);

// @ts-expect-error randomness must be a Uint8Array
fromParts(1, [0, 1, 2]);

// @ts-expect-error timestamp accessors are readonly
value.timestamp = 1;

// @ts-expect-error id accessors are readonly
value.id = '00000000000000000000000000';

// @ts-expect-error randomness is a bigint, not a number
const numericMaximum: number = MAX_RANDOMNESS;

// @ts-expect-error comparison results are limited to -1, 0, and 1
const invalidComparison: PikaidComparison = 2;

// @ts-expect-error the constructor is not part of the public API
new Pikaid();

// @ts-expect-error PikaidLike does not include numbers
const invalidLike: PikaidLike = 123;

void [numericMaximum, invalidComparison, invalidLike];
