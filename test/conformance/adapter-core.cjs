/**
 * Shared JSON-Lines conformance bridge logic.
 *
 * This module is test-only. It contains no PikaID encoding, validation, or
 * randomness logic: every operation is delegated to the real public library
 * object passed by the ESM or CJS adapter entry point. The only work performed
 * here is wire-format conversion (hex/ISO-8601) and error classification.
 */

'use strict';

const MANDATORY_CAPABILITIES = Object.freeze([
  'generate_string',
  'text_to_binary',
  'binary_to_text',
]);

/**
 * Optional capabilities that the public API genuinely exposes.
 *
 * `boolean_validation` -> isValid()
 * `format_only_validation` -> isWellFormed()
 * `parse_components` -> parse()
 * `parse_datetime` -> parse().timestamp (all legal timestamps are representable
 *   by JavaScript Date: max 78,364,164,095 s = 7.84e13 ms < 8.64e15 ms)
 * `generate_with_timestamp` -> generateAt()
 * `generate_binary` -> generateBinary()
 * `generate_binary_with_timestamp` -> generateBinaryAt()
 * `public_compare` -> compare()
 *
 * `csprng_failure_injection` is deliberately NOT advertised: the public
 * package has no injectable RNG seam, and one must not be added solely for the
 * test bridge. That obligation remains a documented manual audit.
 */
const OPTIONAL_CAPABILITIES = Object.freeze([
  'boolean_validation',
  'format_only_validation',
  'parse_components',
  'parse_datetime',
  'generate_with_timestamp',
  'generate_binary',
  'generate_binary_with_timestamp',
  'public_compare',
]);

const VALIDATION_CODES = new Set([
  'INVALID_TYPE',
  'INVALID_LENGTH',
  'INVALID_CHARACTER',
  'TIMESTAMP_OUT_OF_RANGE',
  'TIMESTAMP_OVERFLOW',
  'RANDOMNESS_OVERFLOW',
  'INVALID_RANDOMNESS_LENGTH',
]);

const ENTROPY_CODES = new Set(['CRYPTO_UNAVAILABLE', 'CRYPTO_FAILURE']);

/** An argument rejected by this transport layer, not by the library. */
class InputError extends Error {}

/** An operation outside the protocol vocabulary. */
class UnsupportedOperation extends Error {}

function toHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

function fromHex(value) {
  if (typeof value !== 'string' || !/^(?:[0-9a-f]{2})*$/.test(value)) {
    throw new InputError('binary_hex must be an even-length lowercase hex string');
  }

  return new Uint8Array(Buffer.from(value, 'hex'));
}

function utcDateTime(timestampSeconds) {
  return new Date(timestampSeconds * 1000).toISOString().replace(/\.000Z$/, 'Z');
}

/**
 * Build the operation dispatcher around a real library module.
 *
 * @param {object} api The imported/required public package exports.
 * @returns {(operation: string, args: object) => unknown}
 */
function createDispatcher(api) {
  const required = [
    'compare',
    'fromBinary',
    'generate',
    'generateAt',
    'generateBinary',
    'generateBinaryAt',
    'isValid',
    'isWellFormed',
    'parse',
    'toBinary',
  ];

  for (const name of required) {
    if (typeof api[name] !== 'function') {
      throw new Error(`conformance bridge: public export ${name} is not a function`);
    }
  }

  return function dispatch(operation, args) {
    switch (operation) {
      case 'hello':
        return {
          protocol_version: 1,
          capabilities: [...MANDATORY_CAPABILITIES, ...OPTIONAL_CAPABILITIES],
        };

      case 'generate_string':
        return api.generate();

      case 'text_to_binary':
        return toHex(api.toBinary(args.text));

      case 'binary_to_text':
        return api.fromBinary(fromHex(args.binary_hex));

      case 'boolean_validation':
        return api.isValid(args.text);

      case 'format_only_validation':
        return api.isWellFormed(args.text);

      case 'parse_components': {
        const parsed = api.parse(args.text);
        return {
          timestamp_seconds: parsed.timestamp,
          randomness_hex: parsed.randomnessHex,
          datetime_utc: utcDateTime(parsed.timestamp),
        };
      }

      case 'generate_with_timestamp':
        return api.generateAt(args.timestamp_seconds);

      case 'generate_binary':
        return toHex(api.generateBinary());

      case 'generate_binary_with_timestamp':
        return toHex(api.generateBinaryAt(args.timestamp_seconds));

      case 'public_compare':
        return api.compare(args.a, args.b);

      default:
        throw new UnsupportedOperation(`unknown operation: ${String(operation)}`);
    }
  };
}

function classify(error) {
  if (error instanceof UnsupportedOperation) {
    return 'unsupported_operation';
  }

  if (error instanceof InputError) {
    return 'invalid_input';
  }

  if (error && error.name === 'PikaidError' && typeof error.code === 'string') {
    if (VALIDATION_CODES.has(error.code)) {
      return 'invalid_input';
    }

    if (ENTROPY_CODES.has(error.code)) {
      return 'entropy_unavailable';
    }
  }

  return 'internal_error';
}

function respondWith(dispatch, request) {
  const requestId =
    request !== null && typeof request === 'object' ? request.request_id : null;

  try {
    if (request === null || typeof request !== 'object' || Array.isArray(request)) {
      throw new InputError('request must be a JSON object');
    }

    const operation = request.operation;
    const args = request.arguments;

    if (typeof operation !== 'string') {
      throw new InputError('request operation must be a string');
    }

    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      throw new InputError('request arguments must be an object');
    }

    return {
      request_id: requestId,
      ok: true,
      value: dispatch(operation, args),
    };
  } catch (error) {
    return {
      request_id: requestId,
      ok: false,
      error: {
        category: classify(error),
        message:
          error instanceof Error && error.message
            ? error.message
            : 'unexpected adapter failure',
      },
    };
  }
}

/**
 * Run the protocol loop. Exactly one UTF-8 request line in, one flushed
 * response line out; diagnostics are never written to stdout.
 *
 * @param {object} api The real public library module.
 */
function runAdapter(api) {
  const dispatch = createDispatcher(api);

  let buffer = '';

  const handleLine = (line) => {
    const text = line.endsWith('\r') ? line.slice(0, -1) : line;

    if (text.length === 0) {
      return;
    }

    let request;

    try {
      request = JSON.parse(text);
    } catch {
      const reply = {
        request_id: null,
        ok: false,
        error: { category: 'internal_error', message: 'request is not valid JSON' },
      };
      process.stdout.write(`${JSON.stringify(reply)}\n`);
      return;
    }

    process.stdout.write(`${JSON.stringify(respondWith(dispatch, request))}\n`);
  };

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;

    let newline;

    while ((newline = buffer.indexOf('\n')) !== -1) {
      handleLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
    }
  });

  process.stdin.on('end', () => {
    if (buffer.length > 0) {
      handleLine(buffer);
      buffer = '';
    }
  });
}

module.exports = {
  MANDATORY_CAPABILITIES,
  OPTIONAL_CAPABILITIES,
  classify,
  createDispatcher,
  fromHex,
  runAdapter,
  utcDateTime,
};
