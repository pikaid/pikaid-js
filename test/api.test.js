import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';

import * as direct from '../dist/esm/index.js';
import * as self from 'pikaid';
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
} from '../dist/esm/index.js';

const VALID = '00000010000000000000000001';

describe('public API surface', () => {
  it('exports the documented constants', () => {
    assert.equal(ID_LENGTH, 26);
    assert.equal(TIMESTAMP_CHARS, 7);
    assert.equal(RANDOMNESS_CHARS, 19);
    assert.equal(BINARY_LENGTH, 17);
    assert.equal(TIMESTAMP_BYTES, 5);
    assert.equal(RANDOMNESS_BYTES, 12);
    assert.equal(MAX_TIMESTAMP, 78_364_164_095);
    assert.equal(MAX_RANDOMNESS, (1n << 96n) - 1n);
  });

  it('exports callable generation and conversion functions', () => {
    for (const fn of [
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
    ]) {
      assert.equal(typeof fn, 'function');
    }

    assert.equal(typeof Pikaid, 'function');
    assert.equal(typeof PikaidError, 'function');
  });

  it('supports package self-reference through the exports map', async () => {
    assert.equal(self.parse, direct.parse);
    assert.equal(self.generate, direct.generate);
    assert.equal(self.Pikaid, direct.Pikaid);
    assert.equal(self.MAX_TIMESTAMP, MAX_TIMESTAMP);

    await assert.rejects(import('pikaid/dist/esm/index.js'), {
      code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
  });

  it('declares conventional package metadata and existing entry points', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

    assert.equal(manifest.name, 'pikaid');
    assert.match(manifest.version, /^0\.\d+\.\d+$/);
    assert.equal(manifest.license, 'MIT');
    assert.equal(manifest.type, 'module');
    assert.equal(manifest.sideEffects, false);
    assert.equal(manifest.engines.node, '>=20');
    assert.deepEqual(manifest.dependencies ?? {}, {});
    assert.ok(Array.isArray(manifest.files));

    for (const relative of [
      manifest.main,
      manifest.module,
      manifest.types,
      manifest.exports['.'].import.default,
      manifest.exports['.'].import.types,
      manifest.exports['.'].require.default,
      manifest.exports['.'].require.types,
    ]) {
      assert.equal(statSync(new URL(`../${relative}`, import.meta.url)).isFile(), true);
    }
  });

  it('keeps the high-level class in sync with the free functions', () => {
    const parsed = Pikaid.parse(VALID);

    assert.equal(parsed.id, VALID);
    assert.equal(parsed.timestamp, timestampOf(VALID));
    assert.equal(parsed.randomnessHex, '000000000000000000000001');
    assert.equal(parsed.toString(), VALID);
    assert.equal(parsed.toJSON(), VALID);
    assert.equal(JSON.stringify(parsed), `"${VALID}"`);
    assert.equal(parsed.toBinary().length, BINARY_LENGTH);
    assert.equal(Pikaid.fromBinary(parsed.toBinary()).id, VALID);
    assert.equal(Pikaid.fromParts(parsed.timestamp, parsed.randomness).id, VALID);

    const generated = Pikaid.generate();
    assert.equal(parsed.equals(generated), false);
    assert.ok(parsed.compare(generated) !== 0);
  });

  it('exposes immutable accessors', () => {
    const parsed = Pikaid.parse(VALID);

    assert.equal(Object.getOwnPropertyDescriptor(Pikaid.prototype, 'id').set, undefined);
    assert.equal(Object.getOwnPropertyDescriptor(Pikaid.prototype, 'timestamp').set, undefined);
    assert.equal(Object.getOwnPropertyDescriptor(Pikaid.prototype, 'randomness').set, undefined);
    assert.throws(() => {
      parsed.id = '00000000000000000000000000';
    }, TypeError);
    assert.throws(() => {
      parsed.timestamp = 1;
    }, TypeError);
    assert.equal(parsed.id, VALID);
  });

  it('refuses public construction outside the factory methods', () => {
    assert.throws(() => new Pikaid(), { name: 'PikaidError', code: 'INVALID_TYPE' });
    assert.throws(() => new Pikaid({}), { name: 'PikaidError', code: 'INVALID_TYPE' });
  });

  it('does not treat a Pikaid instance or binary as a string', () => {
    const parsed = Pikaid.parse(VALID);

    assert.throws(() => parse(parsed), { code: 'INVALID_TYPE' });
    assert.equal(isValid(parsed), false);
    assert.throws(() => toBinary(parsed.toBinary()), { code: 'INVALID_TYPE' });
    assert.throws(() => toBinary(parsed), { code: 'INVALID_TYPE' });
  });

  it('constructs errors with stable codes and optional causes', () => {
    const cause = new Error('underlying');
    const error = new PikaidError('INVALID_LENGTH', 'bad length', { cause });

    assert.ok(error instanceof Error);
    assert.ok(error instanceof PikaidError);
    assert.equal(error.name, 'PikaidError');
    assert.equal(error.code, 'INVALID_LENGTH');
    assert.equal(error.message, 'bad length');
    assert.equal(error.cause, cause);
  });

  it('round-trips through JSON without loss', () => {
    const original = Pikaid.parse(VALID);
    const revived = JSON.parse(JSON.stringify({ id: original })).id;

    assert.equal(revived, VALID);
    assert.equal(Pikaid.parse(revived).id, original.id);
  });
});
