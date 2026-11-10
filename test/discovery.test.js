import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { findTestFiles } from '../scripts/run-tests.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testDirectory = path.join(root, 'test');
const TEST_FILE_PATTERN = /\.test\.(?:cjs|js)$/;

function relative(files) {
  return files
    .map((file) => path.relative(root, file).split(path.sep).join('/'))
    .sort();
}

describe('test discovery', () => {
  it('selects every .test.js and .test.cjs file below test/', () => {
    // Independent enumeration: readdirSync's recursive mode, not the runner's
    // own recursive walk, so the runner cannot validate itself by construction.
    const expected = readdirSync(testDirectory, { recursive: true })
      .map((entry) => String(entry))
      .filter((entry) => TEST_FILE_PATTERN.test(entry))
      .map((entry) => `test/${entry.split(path.sep).join('/')}`)
      .sort();

    assert.ok(expected.length > 0, 'fixture sanity: expected test files');
    assert.deepEqual(relative(findTestFiles(testDirectory)), expected);
  });

  it('excludes support modules and keeps the CJS suite', () => {
    const discovered = relative(findTestFiles(testDirectory));

    assert.ok(discovered.includes('test/cjs.test.cjs'));
    assert.ok(discovered.includes('test/api.test.js'));
    assert.ok(!discovered.includes('test/support/helpers.js'));
    assert.ok(discovered.every((file) => TEST_FILE_PATTERN.test(file)));
  });

  it('returns absolute paths in deterministic sorted order', () => {
    const discovered = findTestFiles(testDirectory);

    assert.ok(discovered.every((file) => path.isAbsolute(file)));
    assert.deepEqual(discovered, [...discovered].sort());
    assert.equal(new Set(discovered).size, discovered.length);
  });
});
