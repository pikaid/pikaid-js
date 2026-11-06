import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
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
import { bytesToHex, hexToBytes } from './support/helpers.js';

const VALID = '00000010000000000000000001';
const VALID_BINARY = hexToBytes('0000000001000000000000000000000001');

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof PikaidError, `expected PikaidError, got ${error}`);
    assert.equal(error.code, code);
    assert.equal(error.name, 'PikaidError');
    assert.ok(error instanceof Error);
    return true;
  });
}

describe('strict string validation', () => {
  it('rejects every non-string type without coercion', () => {
    const values = [
      undefined,
      null,
      0,
      1,
      Number.NaN,
      1n,
      true,
      false,
      {},
      [],
      Symbol('pikaid'),
      () => VALID,
      new String(VALID),
      Buffer.from(VALID, 'ascii'),
    ];

    for (const value of values) {
      expectCode(() => parse(value), 'INVALID_TYPE');
      expectCode(() => timestampOf(value), 'INVALID_TYPE');
      expectCode(() => randomnessOf(value), 'INVALID_TYPE');
      expectCode(() => toBinary(value), 'INVALID_TYPE');
      assert.equal(isValid(value), false);
      assert.equal(isWellFormed(value), false);
    }
  });

  it('rejects invalid lengths instead of padding or truncating', () => {
    const values = [
      '',
      '0',
      VALID.slice(0, 25),
      `${VALID}0`,
      `${VALID}00`,
      ` ${VALID}`,
      `${VALID} `,
    ];

    for (const value of values) {
      expectCode(() => parse(value), 'INVALID_LENGTH');
      assert.equal(isValid(value), false);
      assert.equal(isWellFormed(value), false);
    }
  });

  it('rejects every character outside lowercase Base36', () => {
    const replacements = [
      'A',
      'Z',
      '-',
      '_',
      ' ',
      '\n',
      '\t',
      '\u0000',
      'é',
      'É',
      '٣',
      '＋',
      '/',
      ':',
      '@',
      '[',
      '`',
      '{',
      '~',
    ];

    for (const character of replacements) {
      for (const index of [0, 6, 7, 25]) {
        const value = `${VALID.slice(0, index)}${character}${VALID.slice(index + 1)}`;
        expectCode(() => parse(value), 'INVALID_CHARACTER');
        assert.equal(isValid(value), false);
        assert.equal(isWellFormed(value), false);
      }
    }
  });

  it('does not accept uppercase or mixed-case variants', () => {
    expectCode(() => parse('0S44WE8002LOZ3PO6MCF6VSN23'), 'INVALID_CHARACTER');
    expectCode(() => parse('0s44we8002LOZ3PO6MCF6VSN23'), 'INVALID_CHARACTER');
    expectCode(() => parse('000000A0000000000000000000'), 'INVALID_CHARACTER');
    assert.equal(isValid('000000A0000000000000000000'), false);
    assert.equal(isValid('0S44WE8002LOZ3PO6MCF6VSN23'), false);
  });

  it('rejects randomness above 96 bits while keeping the shape check distinct', () => {
    const overflow = `0000000${'z'.repeat(19)}`;

    assert.equal(overflow.length, 26);
    assert.equal(isWellFormed(overflow), true);
    assert.equal(isValid(overflow), false);
    expectCode(() => parse(overflow), 'RANDOMNESS_OVERFLOW');
    expectCode(() => toBinary(overflow), 'RANDOMNESS_OVERFLOW');
  });

  it('accepts zero-padded boundaries exactly', () => {
    assert.equal(timestampOf('00000000000000000000000000'), 0);
    assert.equal(bytesToHex(randomnessOf('00000000000000000000000000')), '0'.repeat(24));

    const maximum = `zzzzzzz${'0'.repeat(19)}`;
    assert.equal(timestampOf(maximum), MAX_TIMESTAMP);
    assert.equal(bytesToHex(randomnessOf(maximum)), '0'.repeat(24));
    assert.equal(isValid(maximum), true);
  });

  it('preserves valid input byte-for-byte', () => {
    const parsed = parse(VALID);
    assert.equal(parsed.id, VALID);
    assert.equal(parsed.toString(), VALID);
    assert.equal(String(parsed), VALID);
    assert.equal(JSON.stringify(parsed), JSON.stringify(VALID));
    assert.equal(JSON.stringify({ id: parsed }), `{"id":"${VALID}"}`);
  });

  it('returns defensive randomness copies', () => {
    const fromFunction = randomnessOf(VALID);
    fromFunction[0] = 0xff;
    assert.equal(bytesToHex(randomnessOf(VALID)), '000000000000000000000001');

    const parsed = parse(VALID);
    const fromGetter = parsed.randomness;
    fromGetter[11] = 0xff;
    assert.equal(parsed.randomnessHex, '000000000000000000000001');
    assert.equal(bytesToHex(parsed.randomness), '000000000000000000000001');

    const binary = parsed.toBinary();
    binary[16] = 0xff;
    assert.equal(parsed.toBinary()[16], 1);
  });

  it('reports useful error messages with stable codes', () => {
    const error = (() => {
      try {
        parse('short');
      } catch (caught) {
        return caught;
      }
      throw new Error('parse should have thrown');
    })();

    assert.ok(error instanceof PikaidError);
    assert.equal(error.code, 'INVALID_LENGTH');
    assert.match(error.message, /26/);
    assert.match(error.message, /received 5/);
  });
});

describe('strict binary validation', () => {
  it('rejects non-Uint8Array values', () => {
    const values = [
      undefined,
      null,
      0,
      '0'.repeat(34),
      [],
      new Array(17).fill(0),
      new ArrayBuffer(17),
      new DataView(new ArrayBuffer(17)),
      { length: 17 },
    ];

    for (const value of values) {
      expectCode(() => fromBinary(value), 'INVALID_TYPE');
      expectCode(() => Pikaid.fromBinary(value), 'INVALID_TYPE');
    }
  });

  it('rejects wrong binary lengths', () => {
    for (const length of [0, 1, 16, 18, 32, 34]) {
      const value = new Uint8Array(length);
      expectCode(() => fromBinary(value), 'INVALID_LENGTH');
      expectCode(() => Pikaid.fromBinary(value), 'INVALID_LENGTH');
    }
  });

  it('rejects binary timestamps above the pikaid maximum', () => {
    const overflow = hexToBytes('123ede4000000000000000000000000000');
    const maximumFortyBit = hexToBytes('ffffffffff000000000000000000000000');

    for (const value of [overflow, maximumFortyBit]) {
      expectCode(() => fromBinary(value), 'TIMESTAMP_OVERFLOW');
      expectCode(() => Pikaid.fromBinary(value), 'TIMESTAMP_OVERFLOW');
    }
  });

  it('accepts the binary timestamp boundary and maximum entropy', () => {
    const boundary = hexToBytes('123ede3fffffffffffffffffffffffffff');
    assert.equal(fromBinary(boundary), 'zzzzzzz7oiylpimjg5u2ca1ypr');
    assert.equal(Pikaid.fromBinary(boundary).timestamp, MAX_TIMESTAMP);
  });

  it('accepts Uint8Array views with non-zero offsets', () => {
    const backing = new Uint8Array(32);
    backing.set(VALID_BINARY, 7);
    const view = backing.subarray(7, 24);

    assert.equal(view.byteOffset, 7);
    assert.equal(fromBinary(view), VALID);
  });

  it('copies input binary so later mutation is harmless', () => {
    const input = new Uint8Array(VALID_BINARY);
    const parsed = Pikaid.fromBinary(input);
    input.fill(0xff);

    assert.equal(parsed.id, VALID);
    assert.equal(bytesToHex(parsed.randomness), '000000000000000000000001');
  });
});

describe('fromParts validation', () => {
  it('copies supplied randomness', () => {
    const randomness = new Uint8Array(12);
    randomness[11] = 1;
    const id = fromParts(1, randomness);
    randomness.fill(0xff);

    assert.equal(id, VALID);
    assert.equal(bytesToHex(randomnessOf(id)), '000000000000000000000001');
  });

  it('rejects invalid randomness types and lengths', () => {
    const invalid = [null, undefined, '0'.repeat(12), [], new ArrayBuffer(12)];

    for (const value of invalid) {
      expectCode(() => fromParts(1, value), 'INVALID_TYPE');
      expectCode(() => Pikaid.fromParts(1, value), 'INVALID_TYPE');
    }

    for (const length of [0, 1, 11, 13, 24]) {
      expectCode(() => fromParts(1, new Uint8Array(length)), 'INVALID_RANDOMNESS_LENGTH');
    }
  });

  it('rejects invalid timestamps', () => {
    const values = [
      -1,
      -0.5,
      0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      MAX_TIMESTAMP + 1,
      Number.MAX_SAFE_INTEGER,
      '1',
      null,
      1n,
    ];

    for (const value of values) {
      expectCode(() => fromParts(value, new Uint8Array(12)), 'TIMESTAMP_OUT_OF_RANGE');
      expectCode(() => Pikaid.fromParts(value, new Uint8Array(12)), 'TIMESTAMP_OUT_OF_RANGE');
    }
  });

  it('normalizes negative zero to zero', () => {
    assert.equal(Pikaid.fromParts(-0, new Uint8Array(12)).timestamp, 0);
  });
});
