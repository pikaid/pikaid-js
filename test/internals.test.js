import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decodeBase36, digitValue, encodeBase36 } from '../dist/esm/base36.js';
import { bigintToBytes, bytesToBigInt, bytesToHex } from '../dist/esm/bytes.js';

describe('internal Base36 primitives', () => {
  it('maps ASCII characters to digit values and rejects the rest', () => {
    assert.equal(digitValue('0'.charCodeAt(0)), 0);
    assert.equal(digitValue('9'.charCodeAt(0)), 9);
    assert.equal(digitValue('a'.charCodeAt(0)), 10);
    assert.equal(digitValue('z'.charCodeAt(0)), 35);
    assert.equal(digitValue('A'.charCodeAt(0)), -1);
    assert.equal(digitValue('-'.charCodeAt(0)), -1);
    assert.equal(digitValue(0), -1);
    assert.equal(digitValue(0x1f600), -1);
  });

  it('decodes Base36 and rejects characters outside the alphabet', () => {
    assert.equal(decodeBase36(''), 0n);
    assert.equal(decodeBase36('0'), 0n);
    assert.equal(decodeBase36('z'), 35n);
    assert.equal(decodeBase36('10'), 36n);
    assert.equal(decodeBase36('zzzzzzz'), 78_364_164_095n);
    assert.throws(() => decodeBase36('A'), RangeError);
    assert.throws(() => decodeBase36('0-0'), RangeError);
  });

  it('encodes to fixed width with zero padding', () => {
    assert.equal(encodeBase36(0n, 7), '0000000');
    assert.equal(encodeBase36(35n, 7), '000000z');
    assert.equal(encodeBase36(36n, 7), '0000010');
    assert.equal(encodeBase36(78_364_164_095n, 7), 'zzzzzzz');
  });

  it('rejects negative and over-wide values', () => {
    assert.throws(() => encodeBase36(-1n, 7), RangeError);
    assert.throws(() => encodeBase36(36n ** 7n, 7), RangeError);
    assert.throws(() => encodeBase36(1n, 0), RangeError);
  });
});

describe('internal byte primitives', () => {
  it('decodes big-endian bytes without using Number', () => {
    assert.equal(bytesToBigInt(new Uint8Array()), 0n);
    assert.equal(bytesToBigInt(new Uint8Array([0x00])), 0n);
    assert.equal(bytesToBigInt(new Uint8Array([0x01, 0x02])), 258n);
    assert.equal(
      bytesToBigInt(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff])),
      1_099_511_627_775n,
    );
  });

  it('encodes exactly the requested number of big-endian bytes', () => {
    assert.equal(bytesToHex(bigintToBytes(0n, 5)), '0000000000');
    assert.equal(bytesToHex(bigintToBytes(1n, 5)), '0000000001');
    assert.equal(bytesToHex(bigintToBytes(2n ** 40n - 1n, 5)), 'ffffffffff');
    assert.equal(bytesToHex(bigintToBytes(0x0102n, 2)), '0102');
  });

  it('rejects negative and over-wide values', () => {
    assert.throws(() => bigintToBytes(-1n, 5), RangeError);
    assert.throws(() => bigintToBytes(2n ** 40n, 5), RangeError);
    assert.throws(() => bigintToBytes(256n, 1), RangeError);
  });
});
