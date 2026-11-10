import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Independent conformance matrix.
 *
 * This file deliberately imports nothing from `dist/`. It re-derives every
 * fixture value with its own BigInt Base36 implementation and its own byte
 * arithmetic, so the implementation under test cannot validate itself by
 * construction. The two digests below pin the exact upstream bytes copied from
 * pikaid-php v1.2.0; any fixture edit fails here first.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, 'vectors', 'pikaid-v1.json');
const schemaPath = path.join(here, 'vectors', 'pikaid-v1.schema.json');

const FIXTURE_SHA256 = 'b0c9dfdd063613424414fef5c9065fbd2f81d645d0ab42b34e27cde715613500';
const SCHEMA_SHA256 = '4441d4dbaa6c5450ae9cbfb2438c53bc0421bba2b7fcc9ef9b158e5d1de0759e';

const fixtureBytes = readFileSync(fixturePath);
const schemaBytes = readFileSync(schemaPath);
const vectors = JSON.parse(fixtureBytes.toString('utf8'));

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 26;
const TIMESTAMP_CHARS = 7;
const RANDOMNESS_CHARS = 19;
const TIMESTAMP_BYTES = 5;
const RANDOMNESS_BYTES = 12;
const BINARY_BYTES = TIMESTAMP_BYTES + RANDOMNESS_BYTES;
const MAX_TIMESTAMP = 78_364_164_095n;
const MAX_RANDOMNESS = (1n << 96n) - 1n;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Independent lowercase Base36 decoder. */
function decodeBase36(text) {
  let value = 0n;

  for (const character of text) {
    const digit = ALPHABET.indexOf(character);
    assert.notEqual(digit, -1, `non-Base36 character ${JSON.stringify(character)}`);
    value = value * 36n + BigInt(digit);
  }

  return value;
}

/** Independent fixed-width lowercase Base36 encoder. */
function encodeBase36(value, width) {
  assert.ok(value >= 0n, 'Base36 encoding requires a non-negative value');

  let remaining = value;
  let encoded = '';

  while (remaining > 0n) {
    encoded = ALPHABET[Number(remaining % 36n)] + encoded;
    remaining /= 36n;
  }

  encoded = encoded.padStart(width, '0');

  assert.equal(encoded.length, width, `value does not fit in ${width} Base36 characters`);
  return encoded;
}

function hexToBigInt(hex) {
  return hex.length === 0 ? 0n : BigInt(`0x${hex}`);
}

function bigIntToHex(value, byteLength) {
  return value.toString(16).padStart(byteLength * 2, '0');
}

/** Classify a string using only the specification rules. */
function classifyString(id) {
  if (typeof id !== 'string' || id.length !== ID_LENGTH) {
    return 'length';
  }

  for (const character of id) {
    if (!ALPHABET.includes(character)) {
      return 'character';
    }
  }

  if (decodeBase36(id.slice(0, TIMESTAMP_CHARS)) > MAX_TIMESTAMP) {
    return 'timestamp';
  }

  if (decodeBase36(id.slice(TIMESTAMP_CHARS)) > MAX_RANDOMNESS) {
    return 'randomness';
  }

  return 'valid';
}

/** Classify a binary form using only the specification rules. */
function classifyBinary(hex) {
  if (hex.length !== BINARY_BYTES * 2) {
    return 'length';
  }

  if (hexToBigInt(hex.slice(0, TIMESTAMP_BYTES * 2)) > MAX_TIMESTAMP) {
    return 'timestamp';
  }

  return 'valid';
}

describe('independent conformance matrix', () => {
  it('pins the exact upstream fixture and schema bytes', () => {
    assert.equal(sha256(fixtureBytes), FIXTURE_SHA256);
    assert.equal(sha256(schemaBytes), SCHEMA_SHA256);
  });

  it('keeps the fixtures BOM-free and LF-only', () => {
    assert.notEqual(fixtureBytes[0], 0xef, 'fixture must not start with a UTF-8 BOM');
    assert.notEqual(schemaBytes[0], 0xef, 'schema must not start with a UTF-8 BOM');
    assert.equal(fixtureBytes.includes(0x0d), false, 'fixture must not contain CR bytes');
    assert.equal(schemaBytes.includes(0x0d), false, 'schema must not contain CR bytes');
  });

  it('describes the normative format exactly once', () => {
    assert.equal(vectors.meta.project, 'pikaid');
    assert.equal(vectors.meta.spec_revision, '1.0.4');
    assert.equal(vectors.meta.identifier_format, 'immutable and unversioned');
    assert.equal(vectors.meta.string_length, ID_LENGTH);
    assert.equal(vectors.meta.timestamp.chars, TIMESTAMP_CHARS);
    assert.equal(BigInt(vectors.meta.timestamp.max), MAX_TIMESTAMP);
    assert.equal(vectors.meta.entropy.chars, RANDOMNESS_CHARS);
    assert.equal(vectors.meta.entropy.bytes, RANDOMNESS_BYTES);
    assert.equal(vectors.meta.binary.bytes, BINARY_BYTES);
    assert.equal(
      vectors.meta.binary.layout,
      '[5 bytes timestamp big-endian][12 bytes entropy]',
    );
    assert.equal('version' in vectors.meta, false);
  });

  it('re-derives every valid vector from first principles', () => {
    assert.ok(vectors.valid.length > 0);

    for (const vector of vectors.valid) {
      const timestamp = BigInt(vector.timestamp);
      const randomness = hexToBigInt(vector.entropy_hex);

      assert.ok(timestamp >= 0n && timestamp <= MAX_TIMESTAMP, vector.name);
      assert.ok(randomness >= 0n && randomness <= MAX_RANDOMNESS, vector.name);

      const expectedId =
        encodeBase36(timestamp, TIMESTAMP_CHARS) +
        encodeBase36(randomness, RANDOMNESS_CHARS);

      assert.equal(expectedId, vector.id, vector.name);
      assert.equal(vector.id.length, ID_LENGTH, vector.name);
      assert.match(vector.id, /^[0-9a-z]{26}$/, vector.name);

      assert.equal(decodeBase36(vector.id.slice(0, TIMESTAMP_CHARS)), timestamp);
      assert.equal(
        decodeBase36(vector.id.slice(TIMESTAMP_CHARS)),
        randomness,
        `${vector.name} randomness`,
      );

      const expectedBinary =
        bigIntToHex(timestamp, TIMESTAMP_BYTES) +
        bigIntToHex(randomness, RANDOMNESS_BYTES);

      assert.equal(expectedBinary, vector.bin_hex, vector.name);
      assert.equal(vector.bin_hex.length, BINARY_BYTES * 2, vector.name);

      assert.equal(classifyString(vector.id), 'valid', vector.name);
      assert.equal(classifyBinary(vector.bin_hex), 'valid', vector.name);
    }
  });

  it('classifies the negative corpus without trusting the implementation', () => {
    assert.ok(vectors.invalid.string.length > 0);
    assert.ok(vectors.invalid.binary.length > 0);

    for (const vector of vectors.invalid.string) {
      assert.notEqual(classifyString(vector.id), 'valid', vector.name);
    }

    for (const vector of vectors.invalid.binary) {
      assert.notEqual(classifyBinary(vector.bin_hex), 'valid', vector.name);
    }

    const overflow = vectors.invalid.string.find(
      (vector) => vector.name === 'entropy-overflow',
    );
    assert.ok(overflow, 'the entropy-overflow vector is required');
    assert.equal(overflow.id.length, ID_LENGTH);
    assert.match(overflow.id, /^[0-9a-z]{26}$/);
    assert.equal(classifyString(overflow.id), 'randomness');

    const timestampOverflow = vectors.invalid.binary.find(
      (vector) => vector.name === 'timestamp-overflow',
    );
    assert.ok(timestampOverflow, 'the binary timestamp-overflow vector is required');
    assert.equal(timestampOverflow.bin_hex.length, BINARY_BYTES * 2);
    assert.equal(classifyBinary(timestampOverflow.bin_hex), 'timestamp');
  });

  it('orders text and binary forms identically', () => {
    const byString = [...vectors.valid].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const byBinary = [...vectors.valid].sort((a, b) =>
      a.bin_hex < b.bin_hex ? -1 : a.bin_hex > b.bin_hex ? 1 : 0,
    );

    assert.deepEqual(
      byString.map((vector) => vector.id),
      byBinary.map((vector) => vector.id),
    );
  });
});
