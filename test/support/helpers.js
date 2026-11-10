import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Official PHP v1.2.0 interoperability fixtures (see test/vectors/README.md). */
export const vectors = JSON.parse(
  readFileSync(path.join(here, '..', 'vectors', 'pikaid-v1.json'), 'utf8'),
);

/** Decode lowercase hexadecimal into bytes. */
export function hexToBytes(hex) {
  if (hex.length % 2 !== 0) {
    throw new Error(`Odd-length hex string: ${hex.length}`);
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

/** Encode bytes as lowercase hexadecimal. */
export function bytesToHex(bytes) {
  let hex = '';

  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }

  return hex;
}

/** Deterministic xorshift32 generator for property tests. */
export function xorshift32(seed) {
  let state = seed >>> 0 || 0x9e3779b9;

  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
}

/** Build 12 deterministic randomness bytes from four 32-bit words. */
export function deterministicRandomness(next) {
  const bytes = new Uint8Array(12);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, next());
  view.setUint32(4, next());
  view.setUint32(8, next());

  return bytes;
}
