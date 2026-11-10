'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const pikaid = require('pikaid-js');

describe('CommonJS entry point', () => {
  it('exports the same public surface', () => {
    for (const name of [
      'Pikaid',
      'PikaidError',
      'generate',
      'generateAt',
      'generateBinary',
      'generateBinaryAt',
      'fromParts',
      'parse',
      'isValid',
      'isWellFormed',
      'toBinary',
      'fromBinary',
      'timestampOf',
      'randomnessOf',
      'compare',
      'MAX_TIMESTAMP',
      'MAX_RANDOMNESS',
    ]) {
      assert.ok(name in pikaid, `missing export ${name}`);
    }
  });

  it('round-trips an official vector', () => {
    const id = '0s44we8002loz3po6mcf6vsn23';
    const binary = pikaid.toBinary(id);

    assert.equal(binary.length, 17);
    assert.equal(Buffer.from(binary).toString('hex'), '006553f10000112233445566778899aabb');
    assert.equal(pikaid.fromBinary(binary), id);
    assert.equal(pikaid.timestampOf(id), 1_700_000_000);
    assert.equal(pikaid.isValid(id), true);
    assert.equal(pikaid.parse(id).id, id);
  });

  it('generates and validates values', () => {
    const id = pikaid.generate();
    assert.equal(id.length, 26);
    assert.equal(pikaid.isValid(id), true);

    const binary = pikaid.generateBinaryAt(1_700_000_000);
    assert.equal(binary.length, 17);
    assert.equal(pikaid.Pikaid.fromBinary(binary).timestamp, 1_700_000_000);
  });

  it('throws coded errors on invalid input', () => {
    assert.throws(
      () => pikaid.parse('not a pikaid'),
      (error) => error instanceof pikaid.PikaidError && error.code === 'INVALID_LENGTH',
    );
    assert.throws(
      () => pikaid.parse('0000000zzzzzzzzzzzzzzzzzzz'),
      { code: 'RANDOMNESS_OVERFLOW' },
    );
  });

  it('resolves package metadata without exposing internals', () => {
    const manifest = require('pikaid-js/package.json');
    assert.equal(manifest.name, 'pikaid-js');

    assert.throws(() => require('pikaid-js/dist/cjs/base36.js'), {
      code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
  });
});
