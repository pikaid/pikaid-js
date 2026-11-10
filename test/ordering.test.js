import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_TIMESTAMP,
  Pikaid,
  compare,
  fromBinary,
  fromParts,
  isValid,
  toBinary,
} from '../dist/esm/index.js';
import { bytesToHex, hexToBytes } from './support/helpers.js';

function idAt(timestamp, entropyHex) {
  return fromParts(timestamp, hexToBytes(entropyHex));
}

const ZERO = idAt(0, '000000000000000000000000');
const ONE_ZERO = idAt(1, '000000000000000000000000');
const ONE_LOW = idAt(1, '000000000000000000000001');
const ONE_HIGH = idAt(1, 'ffffffffffffffffffffffff');
const TWO_ZERO = idAt(2, '000000000000000000000000');
const MAX = idAt(MAX_TIMESTAMP, 'ffffffffffffffffffffffff');

describe('ordering and comparison', () => {
  it('orders different seconds chronologically', () => {
    const ordered = [ZERO, ONE_LOW, TWO_ZERO, MAX];

    for (let left = 0; left < ordered.length; left += 1) {
      for (let right = 0; right < ordered.length; right += 1) {
        const expected = Math.sign(left - right);
        assert.equal(compare(ordered[left], ordered[right]), expected);
      }
    }
  });

  it('orders a full second before the next second regardless of entropy', () => {
    assert.equal(compare(ONE_HIGH, TWO_ZERO), -1);
    assert.equal(compare(TWO_ZERO, ONE_HIGH), 1);
    assert.equal(ONE_HIGH < TWO_ZERO, true);
  });

  it('orders same-second values by randomness, not generation order', () => {
    assert.equal(compare(ONE_LOW, ONE_HIGH), -1);
    assert.equal(compare(ONE_HIGH, ONE_LOW), 1);
    assert.equal(compare(ONE_ZERO, ONE_ZERO), 0);

    const sorted = [ONE_HIGH, ONE_ZERO, ONE_LOW].sort(compare);
    assert.deepEqual(sorted, [ONE_ZERO, ONE_LOW, ONE_HIGH]);
  });

  it('uses unsigned byte order for binary comparison', () => {
    const low = fromParts(1, hexToBytes('00000000000000000000007f'));
    const high = fromParts(1, hexToBytes('000000000000000000000080'));

    assert.equal(compare(low, high), -1);
    assert.equal(Buffer.compare(Buffer.from(toBinary(low)), Buffer.from(toBinary(high))), -1);
  });

  it('matches ASCII lexicographic order for string values', () => {
    const values = [MAX, ZERO, ONE_HIGH, TWO_ZERO, ONE_ZERO, ONE_LOW];

    for (const left of values) {
      for (const right of values) {
        const expected = left < right ? -1 : left > right ? 1 : 0;
        assert.equal(compare(left, right), expected);
      }
    }

    assert.deepEqual([...values].sort(), [...values].sort(compare));
  });

  it('compares mixed representations without loss', () => {
    for (const id of [ZERO, ONE_LOW, ONE_HIGH, MAX]) {
      const binary = toBinary(id);
      const parsed = Pikaid.parse(id);

      assert.equal(compare(id, binary), 0);
      assert.equal(compare(binary, id), 0);
      assert.equal(compare(id, parsed), 0);
      assert.equal(compare(parsed, id), 0);
      assert.equal(compare(binary, parsed), 0);
      assert.equal(compare(toBinary(id), binary), 0);
      assert.equal(Pikaid.compare(id, binary), 0);
    }
  });

  it('exposes compare and equals on values', () => {
    const parsed = Pikaid.parse(ONE_LOW);

    assert.equal(parsed.compare(ONE_HIGH), -1);
    assert.equal(parsed.compare(ONE_LOW), 0);
    assert.equal(parsed.equals(ONE_LOW), true);
    assert.equal(parsed.equals(toBinary(ONE_LOW)), true);
    assert.equal(parsed.equals(ONE_HIGH), false);
  });

  it('sorts a large deterministic set consistently in both representations', () => {
    const ids = [];

    for (let index = 0; index < 100; index += 1) {
      const timestamp = index * 1_000_003;
      const entropy = new Uint8Array(12);
      entropy[10] = (index * 7) & 0xff;
      entropy[11] = index & 0xff;
      ids.push(fromParts(timestamp, entropy));
    }

    const byString = [...ids].sort(compare);
    const byBinary = [...ids].sort((left, right) =>
      Buffer.compare(Buffer.from(toBinary(left)), Buffer.from(toBinary(right))),
    );
    const byNativeString = [...ids].sort();

    assert.deepEqual(byString, byBinary);
    assert.deepEqual(byString, byNativeString);

    for (const id of byString) {
      assert.equal(isValid(id), true);
    }
  });

  it('rejects invalid operands instead of returning an arbitrary order', () => {
    expectCode(() => compare('invalid', ZERO), 'INVALID_LENGTH');
    expectCode(() => compare(ZERO, 'invalid'), 'INVALID_LENGTH');
    expectCode(() => compare('0000000zzzzzzzzzzzzzzzzzzz', ZERO), 'RANDOMNESS_OVERFLOW');
    expectCode(() => compare(ZERO, '0000000zzzzzzzzzzzzzzzzzzz'), 'RANDOMNESS_OVERFLOW');
    expectCode(() => compare(new Uint8Array(16), ZERO), 'INVALID_LENGTH');
    expectCode(() => compare(123, ZERO), 'INVALID_TYPE');
    expectCode(() => compare(ZERO, null), 'INVALID_TYPE');
    expectCode(() => Pikaid.compare(ZERO, {}), 'INVALID_TYPE');

    const parsed = Pikaid.parse(ZERO);
    expectCode(() => parsed.compare('bad'), 'INVALID_LENGTH');
    expectCode(() => parsed.equals('bad'), 'INVALID_LENGTH');

    const invalidBinary = hexToBytes('ffffffffff000000000000000000000000');
    expectCode(() => compare(invalidBinary, ZERO), 'TIMESTAMP_OVERFLOW');
  });

  it('does not mutate inputs during comparison', () => {
    const left = new Uint8Array(toBinary(ONE_LOW));
    const right = new Uint8Array(toBinary(ONE_HIGH));
    const leftBefore = bytesToHex(left);
    const rightBefore = bytesToHex(right);

    compare(left, right);

    assert.equal(bytesToHex(left), leftBefore);
    assert.equal(bytesToHex(right), rightBefore);
  });
});

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.equal(error.name, 'PikaidError');
    assert.equal(error.code, code);
    return true;
  });
}
