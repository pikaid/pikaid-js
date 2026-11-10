import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  Pikaid,
  PikaidError,
  generate,
  generateAt,
  generateBinary,
  generateBinaryAt,
  isWellFormed,
} from '../dist/esm/index.js';

const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

function installCrypto(value) {
  Object.defineProperty(globalThis, 'crypto', {
    value,
    configurable: true,
    writable: true,
  });
}

function restoreCrypto() {
  if (originalDescriptor === undefined) {
    delete globalThis.crypto;
  } else {
    Object.defineProperty(globalThis, 'crypto', originalDescriptor);
  }
}

function expectPikaidError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof PikaidError);
    assert.equal(error.code, code);
    assert.equal(error.name, 'PikaidError');
    assert.match(error.message, /random/i);
    return true;
  });
}

afterEach(restoreCrypto);

describe('cryptographic failure handling', () => {
  it('fails closed when Web Crypto is unavailable', () => {
    delete globalThis.crypto;

    expectPikaidError(() => generate(), 'CRYPTO_UNAVAILABLE');
    expectPikaidError(() => generateAt(1), 'CRYPTO_UNAVAILABLE');
    expectPikaidError(() => generateBinary(), 'CRYPTO_UNAVAILABLE');
    expectPikaidError(() => generateBinaryAt(1), 'CRYPTO_UNAVAILABLE');
    expectPikaidError(() => Pikaid.generate(), 'CRYPTO_UNAVAILABLE');
    expectPikaidError(() => Pikaid.generateAt(1), 'CRYPTO_UNAVAILABLE');
  });

  it('fails closed when getRandomValues is missing', () => {
    installCrypto({});
    expectPikaidError(() => generate(), 'CRYPTO_UNAVAILABLE');

    installCrypto({ getRandomValues: undefined });
    expectPikaidError(() => generate(), 'CRYPTO_UNAVAILABLE');

    installCrypto({ getRandomValues: 'not a function' });
    expectPikaidError(() => generate(), 'CRYPTO_UNAVAILABLE');

    installCrypto(null);
    expectPikaidError(() => generate(), 'CRYPTO_UNAVAILABLE');
  });

  it('fails closed when getRandomValues throws', () => {
    const cause = new Error('hardware RNG failure');
    installCrypto({
      getRandomValues() {
        throw cause;
      },
    });

    assert.throws(
      () => generate(),
      (error) => {
        assert.ok(error instanceof PikaidError);
        assert.equal(error.code, 'CRYPTO_FAILURE');
        assert.equal(error.cause, cause);
        assert.match(error.message, /failed/i);
        return true;
      },
    );
  });

  it('preserves non-Error causes', () => {
    installCrypto({
      getRandomValues() {
        throw 'entropy pool exhausted';
      },
    });

    assert.throws(
      () => generate(),
      (error) => error instanceof PikaidError && error.cause === 'entropy pool exhausted',
    );
  });

  it('recovers when a working CSPRNG becomes available again', () => {
    delete globalThis.crypto;
    expectPikaidError(() => generate(), 'CRYPTO_UNAVAILABLE');

    restoreCrypto();
    const id = generate();
    assert.equal(isWellFormed(id), true);
  });

  it('does not consume randomness for rejected timestamps', () => {
    let calls = 0;
    installCrypto({
      getRandomValues(array) {
        calls += 1;
        array.fill(1);
        return array;
      },
    });

    assert.throws(() => generateAt(-1), { code: 'TIMESTAMP_OUT_OF_RANGE' });
    assert.equal(calls, 0);
  });
});
