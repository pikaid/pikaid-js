/**
 * Error codes exposed by {@link PikaidError}.
 *
 * The codes are stable programmatic identifiers. Messages are human-readable
 * and may change.
 */
export type PikaidErrorCode =
  | 'INVALID_TYPE'
  | 'INVALID_LENGTH'
  | 'INVALID_CHARACTER'
  | 'TIMESTAMP_OUT_OF_RANGE'
  | 'TIMESTAMP_OVERFLOW'
  | 'RANDOMNESS_OVERFLOW'
  | 'INVALID_RANDOMNESS_LENGTH'
  | 'CRYPTO_UNAVAILABLE'
  | 'CRYPTO_FAILURE';

/** Options accepted by {@link PikaidError}. */
export interface PikaidErrorOptions {
  /** The underlying failure, when one is available. */
  cause?: unknown;
}

/**
 * Error thrown by strict pikaid operations.
 *
 * Invalid input is never silently coerced, truncated, or normalized. Callers
 * can branch on {@link PikaidError.code} and, for cryptographic failures,
 * inspect {@link PikaidError.cause}.
 */
export class PikaidError extends Error {
  /** Stable machine-readable error code. */
  readonly code: PikaidErrorCode;

  constructor(
    code: PikaidErrorCode,
    message: string,
    options?: PikaidErrorOptions,
  ) {
    super(message, options);
    this.name = 'PikaidError';
    this.code = code;
  }
}

/**
 * Describe a received value for an error message without invoking coercing
 * conversions on objects.
 */
export function describeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return `a string of length ${value.length}`;
  }

  if (typeof value === 'bigint') {
    return `a bigint (${value.toString()})`;
  }

  if (typeof value === 'symbol') {
    return 'a symbol';
  }

  if (typeof value === 'function') {
    return 'a function';
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `an array of length ${value.length}`;
    }

    if (value instanceof String) {
      return 'a String object (not a string primitive)';
    }

    if (value instanceof Uint8Array) {
      return `a Uint8Array of length ${value.byteLength}`;
    }

    const constructorName = Object.getPrototypeOf(value)?.constructor?.name;
    return constructorName ? `an instance of ${constructorName}` : 'an object';
  }

  return `a ${typeof value} (${String(value)})`;
}
