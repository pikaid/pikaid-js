import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BINARY_LENGTH,
  MAX_RANDOMNESS,
  MAX_TIMESTAMP,
  Pikaid,
  PikaidError,
  fromBinary,
  fromParts,
  isValid,
  isWellFormed,
  parse,
  randomnessOf,
  timestampOf,
  toBinary,
} from '../dist/esm/index.js';
import { bytesToHex, hexToBytes, vectors } from './support/helpers.js';

describe('official pikaid-php v1.2.0 vectors', () => {
  it('describes the pinned specification revision and format', () => {
    assert.equal(vectors.meta.spec_revision, '1.0.4');
    assert.equal(vectors.meta.identifier_format, 'immutable and unversioned');
    assert.equal(vectors.meta.string_length, 26);
    assert.equal(vectors.meta.timestamp.chars, 7);
    assert.equal(vectors.meta.timestamp.max, MAX_TIMESTAMP);
    assert.equal(vectors.meta.entropy.bytes, 12);
    assert.equal(vectors.meta.entropy.chars, 19);
    assert.equal(vectors.meta.binary.bytes, BINARY_LENGTH);
    assert.equal(
      vectors.meta.binary.layout,
      '[5 bytes timestamp big-endian][12 bytes entropy]',
    );
  });

  it('matches the recorded schema shape and constants', () => {
    assert.equal(MAX_TIMESTAMP, 78_364_164_095);
    assert.equal(MAX_RANDOMNESS, (1n << 96n) - 1n);
    assert.ok(vectors.valid.length > 0);
    assert.ok(vectors.invalid.string.length > 0);
    assert.ok(vectors.invalid.binary.length > 0);

    for (const vector of vectors.valid) {
      assert.equal(typeof vector.name, 'string');
      assert.ok(Number.isInteger(vector.timestamp) && vector.timestamp >= 0);
      assert.match(vector.entropy_hex, /^[0-9a-f]{24}$/);
      assert.match(vector.id, /^[0-9a-z]{26}$/);
      assert.match(vector.bin_hex, /^[0-9a-f]{34}$/);
    }

    for (const vector of vectors.invalid.string) {
      assert.equal(typeof vector.name, 'string');
      assert.equal(typeof vector.id, 'string');
    }

    for (const vector of vectors.invalid.binary) {
      assert.equal(typeof vector.name, 'string');
      assert.match(vector.bin_hex, /^[0-9a-f]+$/);
    }
  });

  for (const vector of vectors.valid) {
    describe(`valid: ${vector.name}`, () => {
      it('decodes timestamp and entropy', () => {
        assert.equal(timestampOf(vector.id), vector.timestamp);
        assert.equal(bytesToHex(randomnessOf(vector.id)), vector.entropy_hex);
      });

      it('encodes from explicit parts', () => {
        const randomness = hexToBytes(vector.entropy_hex);
        assert.equal(fromParts(vector.timestamp, randomness), vector.id);
      });

      it('round-trips through the 17-byte binary form', () => {
        const binary = toBinary(vector.id);
        assert.equal(binary.length, 17);
        assert.equal(bytesToHex(binary), vector.bin_hex);
        assert.equal(fromBinary(binary), vector.id);
        assert.equal(fromBinary(hexToBytes(vector.bin_hex)), vector.id);
      });

      it('parses into an equivalent immutable value', () => {
        const parsed = parse(vector.id);
        assert.ok(parsed instanceof Pikaid);
        assert.equal(parsed.id, vector.id);
        assert.equal(parsed.timestamp, vector.timestamp);
        assert.equal(bytesToHex(parsed.randomness), vector.entropy_hex);
        assert.equal(parsed.randomnessHex, vector.entropy_hex);
        assert.equal(bytesToHex(parsed.toBinary()), vector.bin_hex);
        assert.equal(Pikaid.fromBinary(hexToBytes(vector.bin_hex)).id, vector.id);
      });

      it('is valid and well formed', () => {
        assert.equal(isValid(vector.id), true);
        assert.equal(isWellFormed(vector.id), true);
      });
    });
  }

  for (const vector of vectors.invalid.string) {
    it(`rejects invalid string: ${vector.name}`, () => {
      assert.equal(isValid(vector.id), false);
      assert.throws(() => parse(vector.id), PikaidError);
      assert.throws(() => timestampOf(vector.id), PikaidError);
      assert.throws(() => randomnessOf(vector.id), PikaidError);
      assert.throws(() => toBinary(vector.id), PikaidError);
    });
  }

  for (const vector of vectors.invalid.binary) {
    it(`rejects invalid binary: ${vector.name}`, () => {
      const binary = hexToBytes(vector.bin_hex);
      assert.throws(() => fromBinary(binary), PikaidError);
      assert.throws(() => Pikaid.fromBinary(binary), PikaidError);
    });
  }

  it('keeps the historical vector filename from versioning the format', () => {
    // The fixture is called pikaid-v1 for historical reasons only.
    assert.equal(vectors.meta.identifier_format, 'immutable and unversioned');
    assert.ok(!('version' in vectors.meta));
  });
});
