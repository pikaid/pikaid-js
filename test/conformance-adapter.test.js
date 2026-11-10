import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import * as api from '../dist/esm/index.js';

const require = createRequire(import.meta.url);
const {
  MANDATORY_CAPABILITIES,
  OPTIONAL_CAPABILITIES,
  classify,
  createDispatcher,
  fromHex,
  utcDateTime,
} = require('./conformance/adapter-core.cjs');

const dispatch = createDispatcher(api);

describe('official conformance JSON-Lines adapter', () => {
  it('advertises exactly the capabilities it can really implement', () => {
    const hello = dispatch('hello', {});

    assert.equal(hello.protocol_version, 1);
    assert.deepEqual(hello.capabilities, [
      ...MANDATORY_CAPABILITIES,
      ...OPTIONAL_CAPABILITIES,
    ]);
    assert.ok(hello.capabilities.includes('parse_datetime'));
    assert.ok(!hello.capabilities.includes('csprng_failure_injection'));
  });

  it('delegates generation to the real public API', () => {
    const generated = dispatch('generate_string', {});

    assert.equal(typeof generated, 'string');
    assert.equal(generated.length, 26);
    assert.equal(api.isValid(generated), true);
  });

  it('converts text and binary forms without reimplementing the codec', () => {
    const zero = '00000000000000000000000000';
    const hex = dispatch('text_to_binary', { text: zero });

    assert.equal(hex, '00'.repeat(17));
    assert.equal(dispatch('binary_to_text', { binary_hex: hex }), zero);

    const generated = dispatch('generate_string', {});
    const binary = dispatch('text_to_binary', { text: generated });

    assert.match(binary, /^(?:[0-9a-f]{2}){17}$/);
    assert.equal(dispatch('binary_to_text', { binary_hex: binary }), generated);
  });

  it('returns lossless integer components and an exact UTC datetime', () => {
    const parsed = dispatch('parse_components', {
      text: '00000000000000000000000000',
    });

    assert.equal(parsed.timestamp_seconds, 0);
    assert.equal(parsed.randomness_hex, '00'.repeat(12));
    assert.equal(parsed.datetime_utc, '1970-01-01T00:00:00Z');
    assert.equal(utcDateTime(1_700_000_000), '2023-11-14T22:13:20Z');
  });

  it('maps documented validation errors to invalid_input only', () => {
    const rejection = (fn) => {
      try {
        fn();
        return 'no_error';
      } catch (error) {
        return classify(error);
      }
    };

    assert.equal(rejection(() => api.parse('not-a-pikaid')), 'invalid_input');
    assert.equal(
      rejection(() => api.toBinary('0000000000000000000000000!')),
      'invalid_input',
    );
    assert.equal(
      classify({
        name: 'PikaidError',
        code: 'CRYPTO_UNAVAILABLE',
        message: 'no csprng',
      }),
      'entropy_unavailable',
    );
    assert.equal(
      classify({
        name: 'PikaidError',
        code: 'CRYPTO_FAILURE',
        message: 'csprng threw',
      }),
      'entropy_unavailable',
    );
    assert.equal(
      classify({
        name: 'PikaidError',
        code: 'SOMETHING_NEW',
        message: 'unknown',
      }),
      'internal_error',
    );
    assert.equal(classify(new TypeError('boom')), 'internal_error');
  });

  it('reports unknown operations as unsupported_operation', () => {
    assert.throws(
      () => dispatch('inject_fault', { fault: 'csprng_failure', active: true }),
      (error) => classify(error) === 'unsupported_operation',
    );
  });

  it('rejects malformed transport hex instead of coercing it', () => {
    assert.throws(() => fromHex('ABC'), /lowercase hex/);
    assert.throws(() => fromHex('aa0'), /lowercase hex/);
    assert.throws(() => fromHex('AA'.repeat(17)), /lowercase hex/);
    assert.deepEqual([...fromHex('00ff')], [0, 255]);
  });

  it('formats every legal timestamp without local-time drift', () => {
    assert.equal(
      utcDateTime(api.MAX_TIMESTAMP),
      new Date(api.MAX_TIMESTAMP * 1000).toISOString().replace('.000Z', 'Z'),
    );
    assert.equal(utcDateTime(api.MAX_TIMESTAMP), '4453-04-05T15:21:35Z');
  });
});
