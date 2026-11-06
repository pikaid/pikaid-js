import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_TIMESTAMP,
  Pikaid,
  generate,
  generateAt,
  generateBinary,
  generateBinaryAt,
  fromParts,
  isValid,
  parse,
  randomnessOf,
  timestampOf,
} from '../dist/esm/index.js';
import { bytesToHex } from './support/helpers.js';

function withCrypto(value, callback) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', {
    value,
    configurable: true,
    writable: true,
  });

  try {
    return callback();
  } finally {
    if (descriptor === undefined) {
      delete globalThis.crypto;
    } else {
      Object.defineProperty(globalThis, 'crypto', descriptor);
    }
  }
}

function withNow(value, callback) {
  const original = Date.now;
  Date.now = () => value;

  try {
    return callback();
  } finally {
    Date.now = original;
  }
}

function deterministicCrypto() {
  const calls = [];

  return {
    calls,
    crypto: {
      getRandomValues(array) {
        calls.push({ length: array.length, constructor: array.constructor.name });
        array.fill(0xab);
        return array;
      },
    },
  };
}

describe('secure generation', () => {
  it('generates a valid 26-character id from the platform CSPRNG', () => {
    const before = Math.floor(Date.now() / 1000);
    const id = generate();
    const after = Math.floor(Date.now() / 1000);

    assert.equal(id.length, 26);
    assert.equal(isValid(id), true);
    assert.equal(timestampOf(id) >= before && timestampOf(id) <= after, true);
    assert.equal(parse(id).id, id);
  });

  it('uses exactly twelve bytes from getRandomValues', () => {
    const { calls, crypto } = deterministicCrypto();

    const id = withCrypto(crypto, () => generateAt(1_700_000_000));

    assert.deepEqual(calls, [{ length: 12, constructor: 'Uint8Array' }]);
    assert.equal(timestampOf(id), 1_700_000_000);
    assert.equal(bytesToHex(randomnessOf(id)), 'ab'.repeat(12));
  });

  it('generates a binary id from exactly twelve CSPRNG bytes', () => {
    const { calls, crypto } = deterministicCrypto();

    const binary = withCrypto(crypto, () => generateBinaryAt(1));

    assert.deepEqual(calls, [{ length: 12, constructor: 'Uint8Array' }]);
    assert.equal(binary.length, 17);
    assert.equal(bytesToHex(binary), `0000000001${'ab'.repeat(12)}`);
  });

  it('supports explicit timestamp boundaries', () => {
    const { crypto } = deterministicCrypto();

    const zero = withCrypto(crypto, () => generateAt(0));
    const maximum = withCrypto(crypto, () => generateAt(MAX_TIMESTAMP));

    assert.equal(zero.slice(0, 7), '0000000');
    assert.equal(timestampOf(zero), 0);
    assert.equal(maximum.slice(0, 7), 'zzzzzzz');
    assert.equal(timestampOf(maximum), MAX_TIMESTAMP);
    assert.equal(isValid(zero), true);
    assert.equal(isValid(maximum), true);
    assert.equal(withCrypto(crypto, () => Pikaid.generateAt(0)).timestamp, 0);
  });

  it('generates current-time binary ids', () => {
    const before = Math.floor(Date.now() / 1000);
    const binary = generateBinary();
    const after = Math.floor(Date.now() / 1000);

    assert.equal(binary.length, 17);
    const timestamp = Pikaid.fromBinary(binary).timestamp;
    assert.equal(timestamp >= before && timestamp <= after, true);
  });

  it('produces distinct values with 96 bits of randomness', () => {
    const seen = new Set();

    for (let index = 0; index < 200; index += 1) {
      const id = generate();
      assert.equal(isValid(id), true);
      assert.equal(seen.has(id), false, `duplicate generated id at iteration ${index}`);
      seen.add(id);
    }

    assert.equal(seen.size, 200);
  });

  it('rejects invalid explicit timestamps', () => {
    const { crypto } = deterministicCrypto();
    const values = [-1, 0.25, Number.NaN, Number.POSITIVE_INFINITY, MAX_TIMESTAMP + 1, '0', null];

    withCrypto(crypto, () => {
      for (const value of values) {
        assert.throws(() => generateAt(value), { name: 'PikaidError', code: 'TIMESTAMP_OUT_OF_RANGE' });
        assert.throws(
          () => generateBinaryAt(value),
          { name: 'PikaidError', code: 'TIMESTAMP_OUT_OF_RANGE' },
        );
        assert.throws(
          () => Pikaid.generateAt(value),
          { name: 'PikaidError', code: 'TIMESTAMP_OUT_OF_RANGE' },
        );
      }
    });
  });

  it('fails closed when the system clock is outside the timestamp range', () => {
    const { crypto } = deterministicCrypto();

    withCrypto(crypto, () => {
      withNow((MAX_TIMESTAMP + 1) * 1000, () => {
        assert.throws(() => generate(), { code: 'TIMESTAMP_OUT_OF_RANGE' });
        assert.throws(() => generateBinary(), { code: 'TIMESTAMP_OUT_OF_RANGE' });
        assert.throws(() => Pikaid.generate(), { code: 'TIMESTAMP_OUT_OF_RANGE' });
      });

      withNow(-2_000, () => {
        assert.throws(() => generate(), { code: 'TIMESTAMP_OUT_OF_RANGE' });
      });

      withNow(Number.NaN, () => {
        assert.throws(() => generate(), { code: 'TIMESTAMP_OUT_OF_RANGE' });
      });
    });
  });

  it('uses the last complete second at the upper timestamp boundary', () => {
    const { crypto } = deterministicCrypto();

    const id = withCrypto(crypto, () =>
      withNow(MAX_TIMESTAMP * 1000 + 999, () => generate()),
    );

    assert.equal(timestampOf(id), MAX_TIMESTAMP);
  });

  it('keeps deterministic construction independent of the CSPRNG', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    delete globalThis.crypto;

    try {
      const id = fromParts(1, new Uint8Array(12));
      assert.equal(id, '00000010000000000000000000');
      assert.equal(Pikaid.fromParts(1, new Uint8Array(12)).id, id);
    } finally {
      if (descriptor !== undefined) {
        Object.defineProperty(globalThis, 'crypto', descriptor);
      }
    }
  });
});
