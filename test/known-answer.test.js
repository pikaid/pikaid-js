import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_RANDOMNESS,
  MAX_TIMESTAMP,
  fromBinary,
  fromParts,
  isValid,
  parse,
  randomnessOf,
  timestampOf,
  toBinary,
} from '../dist/esm/index.js';
import { bytesToHex, hexToBytes } from './support/helpers.js';

/**
 * Known-answer cases computed independently with Python integer arithmetic.
 * None of the expected values below are produced by the implementation under
 * test. They cover Base36 carries, zero padding, and both field boundaries.
 */
const KNOWN_ANSWERS = [
  {
    name: 'zero timestamp and zero randomness',
    timestamp: 0,
    entropyHex: '000000000000000000000000',
    id: '00000000000000000000000000',
  },
  {
    name: 'timestamp one, entropy one',
    timestamp: 1,
    entropyHex: '000000000000000000000001',
    id: '00000010000000000000000001',
  },
  {
    name: 'last single-digit timestamp and entropy',
    timestamp: 35,
    entropyHex: '000000000000000000000023',
    id: '000000z000000000000000000z',
  },
  {
    name: 'first two-digit carry in both fields',
    timestamp: 36,
    entropyHex: '000000000000000000000024',
    id: '00000100000000000000000010',
  },
  {
    name: 'timestamp two-digit maximum with zero entropy',
    timestamp: 1295,
    entropyHex: '000000000000000000000000',
    id: '00000zz0000000000000000000',
  },
  {
    name: 'timestamp three-digit carry with zero entropy',
    timestamp: 1296,
    entropyHex: '000000000000000000000000',
    id: '00001000000000000000000000',
  },
  {
    name: 'timestamp and entropy at two-digit maximum',
    timestamp: 1295,
    entropyHex: '00000000000000000000050f',
    id: '00000zz00000000000000000zz',
  },
  {
    name: 'timestamp and entropy at three-digit carry',
    timestamp: 1296,
    entropyHex: '000000000000000000000510',
    id: '00001000000000000000000100',
  },
  {
    name: 'timestamp boundary near 2^36 with packed entropy',
    timestamp: 68_719_476_735,
    entropyHex: '00000000000cfd41b9100000',
    id: 'vkhsvlr0000000010000000000',
  },
  {
    name: 'sample timestamp with high entropy bit',
    timestamp: 1_234_567_890,
    entropyHex: '800000000000000000000000',
    id: '0kf12oi3u9haurb9q2x1650zcw',
  },
  {
    name: 'maximum randomness minus one',
    timestamp: 999_999_999,
    entropyHex: 'fffffffffffffffffffffffe',
    id: '0gjdgxr7oiylpimjg5u2ca1ypq',
  },
  {
    name: 'maximum timestamp, zero randomness',
    timestamp: MAX_TIMESTAMP,
    entropyHex: '000000000000000000000000',
    id: 'zzzzzzz0000000000000000000',
  },
  {
    name: 'maximum timestamp and maximum randomness',
    timestamp: MAX_TIMESTAMP,
    entropyHex: 'ffffffffffffffffffffffff',
    id: 'zzzzzzz7oiylpimjg5u2ca1ypr',
  },
];

describe('independent known-answer cases', () => {
  for (const vector of KNOWN_ANSWERS) {
    it(vector.name, () => {
      const entropy = hexToBytes(vector.entropyHex);

      assert.equal(fromParts(vector.timestamp, entropy), vector.id);
      assert.equal(timestampOf(vector.id), vector.timestamp);
      assert.equal(bytesToHex(randomnessOf(vector.id)), vector.entropyHex);
      assert.equal(parse(vector.id).id, vector.id);
      assert.equal(isValid(vector.id), true);

      const binary = toBinary(vector.id);
      assert.equal(binary.length, 17);
      assert.equal(fromBinary(binary), vector.id);
    });
  }

  it('rejects the first Base36 value above 96 bits', () => {
    // 2^96 = 79,228,162,514,264,337,593,543,950,336
    // Base36(2^96) = 7oiylpimjg5u2ca1yps, which is not valid randomness.
    const overflowId = `0000000${'7oiylpimjg5u2ca1yps'}`;

    assert.equal(overflowId.length, 26);
    assert.equal(isValid(overflowId), false);
    assert.throws(() => parse(overflowId), { code: 'RANDOMNESS_OVERFLOW' });
  });

  it('accepts the largest optimistically encoded string shape only semantically', () => {
    // Nineteen 'z' digits are 36^19-1, well above 2^96-1.
    const maximumShape = `0000000${'z'.repeat(19)}`;

    assert.equal(maximumShape.length, 26);
    assert.equal(isValid(maximumShape), false);
    assert.throws(() => parse(maximumShape), { code: 'RANDOMNESS_OVERFLOW' });
  });

  it('treats MAX_RANDOMNESS as an exact bigint, not a number', () => {
    assert.equal(typeof MAX_RANDOMNESS, 'bigint');
    assert.equal(MAX_RANDOMNESS, 79_228_162_514_264_337_593_543_950_335n);
    assert.equal(MAX_RANDOMNESS.toString(16), 'f'.repeat(24));
  });
});
