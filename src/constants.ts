/**
 * pikaid format constants.
 *
 * The identifier format is immutable and unversioned. These values are defined
 * by pikaid specification revision 1.0.4 and must not be changed.
 *
 * @see https://github.com/pikaid/pikaid-specs/tree/v1.0.4
 */

/** Total length of a pikaid string: 26 lowercase Base36 characters. */
export const ID_LENGTH = 26;

/** Width of the timestamp component in the string form. */
export const TIMESTAMP_CHARS = 7;

/** Width of the randomness component in the string form. */
export const RANDOMNESS_CHARS = 19;

/** Total length of the binary representation in bytes. */
export const BINARY_LENGTH = 17;

/** Width of the timestamp component in the binary form. */
export const TIMESTAMP_BYTES = 5;

/** Width of the randomness component in the binary form. */
export const RANDOMNESS_BYTES = 12;

/**
 * Largest representable timestamp: `36^7 - 1` (78,364,164,095 seconds).
 *
 * This is the string-format limit. Five bytes can hold larger values, but such
 * values are not valid pikaid timestamps.
 */
export const MAX_TIMESTAMP = 78_364_164_095;

/**
 * Largest representable randomness value: `2^96 - 1`.
 *
 * Nineteen Base36 characters can encode values above this bound; those values
 * are not valid pikaid randomness.
 */
export const MAX_RANDOMNESS = (1n << 96n) - 1n;
