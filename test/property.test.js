import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_RANDOMNESS,
  MAX_TIMESTAMP,
  compare,
  fromBinary,
  fromParts,
  isValid,
  isWellFormed,
  parse,
  randomnessOf,
  timestampOf,
  toBinary,
} from '../dist/esm/index.js';
import {
  bytesToHex,
  deterministicRandomness,
  hexToBytes,
  xorshift32,
} from './support/helpers.js';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Independent fixed-width Base36 encoder used only as a test oracle. */
function oracleBase36(value, width) {
  let remaining = value;
  let output = '';

  do {
    output = ALPHABET[Number(remaining % 36n)] + output;
    remaining /= 36n;
  } while (remaining > 0n);

  return output.padStart(width, '0');
}

/** Independent unsigned big-endian byte encoder used only as a test oracle. */
function oracleBytes(value, length) {
  const bytes = new Uint8Array(length);
  let remaining = value;

  for (let index = length - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  assert.equal(remaining, 0n);
  return bytes;
}

/** Independent oracle for full pikaid validity. */
function oracleIsValid(value) {
  if (typeof value !== 'string' || value.length !== 26) {
    return false;
  }

  for (const character of value) {
    if (!ALPHABET.includes(character)) {
      return false;
    }
  }

  const timestampHex = [...value.slice(0, 7)].reduce(
    (total, character) => total * 36n + BigInt(ALPHABET.indexOf(character)),
    0n,
  );
  const randomness = [...value.slice(7)].reduce(
    (total, character) => total * 36n + BigInt(ALPHABET.indexOf(character)),
    0n,
  );

  return timestampHex <= BigInt(MAX_TIMESTAMP) && randomness <= MAX_RANDOMNESS;
}

describe('randomized round-trip properties', () => {
  it('round-trips 300 deterministic timestamp/entropy pairs', () => {
    const next = xorshift32(0x5eed_1234);
    const timestampRange = BigInt(MAX_TIMESTAMP) + 1n;

    for (let iteration = 0; iteration < 300; iteration += 1) {
      const timestamp = Number(
        ((BigInt(next()) << 32n) | BigInt(next())) % timestampRange,
      );
      const entropy = deterministicRandomness(next);
      const entropyValue = BigInt(`0x${bytesToHex(entropy)}`);

      const id = fromParts(timestamp, entropy);
      const binary = toBinary(id);
      const parsed = parse(id);

      assert.equal(id.length, 26);
      assert.equal(isValid(id), true);
      assert.equal(isWellFormed(id), true);
      assert.equal(timestampOf(id), timestamp);
      assert.equal(bytesToHex(randomnessOf(id)), bytesToHex(entropy));
      assert.equal(parsed.timestamp, timestamp);
      assert.equal(bytesToHex(parsed.randomness), bytesToHex(entropy));
      assert.equal(binary.length, 17);
      assert.equal(fromBinary(binary), id);
      assert.equal(bytesToHex(toBinary(fromBinary(binary))), bytesToHex(binary));
      assert.equal(compare(id, binary), 0);

      assert.equal(
        id,
        oracleBase36(BigInt(timestamp), 7) + oracleBase36(entropyValue, 19),
      );
      assert.equal(
        bytesToHex(binary),
        bytesToHex(oracleBytes(BigInt(timestamp), 5)) + bytesToHex(entropy),
      );
    }
  });

  it('round-trips every field boundary combination', () => {
    const timestamps = [0, 1, 35, 36, 1_295, 1_296, 46_655, 46_656, MAX_TIMESTAMP - 1, MAX_TIMESTAMP];
    const randomnessValues = [
      0n,
      1n,
      35n,
      36n,
      1_295n,
      1_296n,
      1n << 95n,
      MAX_RANDOMNESS - 1n,
      MAX_RANDOMNESS,
    ];

    for (const timestamp of timestamps) {
      for (const randomness of randomnessValues) {
        const entropy = oracleBytes(randomness, 12);
        const id = fromParts(timestamp, entropy);
        const expected =
          oracleBase36(BigInt(timestamp), 7) + oracleBase36(randomness, 19);

        assert.equal(id, expected);
        assert.equal(timestampOf(id), timestamp);
        assert.equal(bytesToHex(randomnessOf(id)), bytesToHex(entropy));
        assert.equal(fromBinary(toBinary(id)), id);
        assert.equal(bytesToHex(toBinary(id)), bytesToHex(oracleBytes(BigInt(timestamp), 5)) + bytesToHex(entropy));
      }
    }
  });

  it('agrees with an independent oracle on 500 arbitrary 26-character strings', () => {
    const next = xorshift32(0xc0ff_ee01);
    const printable = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_ !@#$%^&*()é';

    for (let iteration = 0; iteration < 500; iteration += 1) {
      let value = '';

      for (let index = 0; index < 26; index += 1) {
        value += printable[next() % printable.length];
      }

      assert.equal(isValid(value), oracleIsValid(value), `mismatch for ${JSON.stringify(value)}`);

      if (oracleIsValid(value)) {
        assert.equal(toBinary(value).length, 17);
      } else {
        assert.throws(() => parse(value), { name: 'PikaidError' });
      }
    }
  });

  it('agrees with an independent oracle on 500 arbitrary 17-byte inputs', () => {
    const next = xorshift32(0xbadc_0de1);
    let accepted = 0;
    let rejected = 0;

    for (let iteration = 0; iteration < 500; iteration += 1) {
      const binary = deterministicRandomness(next);
      const full = new Uint8Array(17);
      full.set(deterministicRandomness(next), 0);
      full.set(binary, 5);

      const timestamp = BigInt(`0x${bytesToHex(full.subarray(0, 5))}`);
      const valid = timestamp <= BigInt(MAX_TIMESTAMP);

      if (valid) {
        accepted += 1;
        const id = fromBinary(full);
        assert.equal(timestampOf(id), Number(timestamp));
        assert.equal(bytesToHex(toBinary(id)), bytesToHex(full));
      } else {
        rejected += 1;
        assert.throws(() => fromBinary(full), { code: 'TIMESTAMP_OVERFLOW' });
      }
    }

    assert.ok(accepted > 0);
    assert.ok(rejected > 0);
  });

  it('rejects random strings above the randomness bound', () => {
    const next = xorshift32(0xdead_10cc);

    for (let iteration = 0; iteration < 100; iteration += 1) {
      const timestamp = oracleBase36(BigInt(next() % (MAX_TIMESTAMP + 1)), 7);
      const suffix = `${'z'.repeat(19).slice(0, 18)}${ALPHABET[next() % 36]}`;
      const value = timestamp + suffix;

      assert.equal(isWellFormed(value), true);
      const independent = oracleIsValid(value);
      assert.equal(isValid(value), independent);

      if (!independent) {
        assert.throws(() => parse(value), { code: 'RANDOMNESS_OVERFLOW' });
      }
    }
  });

  it('comparison agrees with unsigned binary order on 200 random pairs', () => {
    const next = xorshift32(0x0dd_ba11);
    const timestampRange = BigInt(MAX_TIMESTAMP) + 1n;

    for (let iteration = 0; iteration < 200; iteration += 1) {
      const make = () => {
        const timestamp = Number(
          ((BigInt(next()) << 32n) | BigInt(next())) % timestampRange,
        );
        return fromParts(timestamp, deterministicRandomness(next));
      };

      const left = make();
      const right = make();
      const expected = Buffer.compare(
        Buffer.from(toBinary(left)),
        Buffer.from(toBinary(right)),
      );

      assert.equal(compare(left, right), expected);
      assert.equal(compare(left, right), left < right ? -1 : left > right ? 1 : 0);
    }
  });
});
