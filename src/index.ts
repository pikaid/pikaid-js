/**
 * Official JavaScript and TypeScript implementation of pikaid.
 *
 * pikaid is a compact, chronologically sortable, collision-resistant
 * identifier: 26 lowercase Base36 characters or 17 binary bytes.
 *
 * @see https://github.com/pikaid/pikaid-specs/tree/v1.0.4
 */

export {
  BINARY_LENGTH,
  ID_LENGTH,
  MAX_RANDOMNESS,
  MAX_TIMESTAMP,
  RANDOMNESS_BYTES,
  RANDOMNESS_CHARS,
  TIMESTAMP_BYTES,
  TIMESTAMP_CHARS,
} from './constants.js';

export { PikaidError, type PikaidErrorCode } from './errors.js';

export {
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
  Pikaid,
  randomnessOf,
  timestampOf,
  toBinary,
  type PikaidComparison,
  type PikaidLike,
} from './pikaid.js';
