/**
 * Cross-platform `node:test` discovery and runner.
 *
 * Newer Node.js releases no longer accept a directory as a positional argument
 * to `--test`, and shell globs are not portable (they do not expand the same
 * way in PowerShell, cmd.exe, and POSIX shells). This script performs the
 * discovery itself, recursively, and passes explicit file paths to the test
 * runner. Only `*.test.js` and `*.test.cjs` files are selected, so support
 * modules such as `test/support/helpers.js` are never executed as independent
 * test files.
 *
 * Any arguments are forwarded to Node.js before `--test`, which allows the
 * coverage script to pass `--experimental-test-coverage` and threshold flags
 * without changing the runtime selection.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const testDirectory = path.join(root, 'test');

const TEST_FILE_PATTERN = /\.test\.(?:cjs|js)$/;

/**
 * Recursively collect test files below `directory` in a deterministic order.
 *
 * @param {string} directory Absolute path to the directory to scan.
 * @returns {string[]} Absolute paths to `*.test.js` and `*.test.cjs` files.
 */
export function findTestFiles(directory) {
  const files = [];

  /** @param {string} current */
  const walk = (current) => {
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
        files.push(entryPath);
      }
    }
  };

  walk(directory);

  return files;
}

/**
 * Run the discovered test files with the current Node.js executable.
 *
 * @param {string[]} nodeArguments Arguments forwarded to Node.js (for example
 *   coverage flags).
 * @returns {number} The child process exit status.
 */
export function runTests(nodeArguments = []) {
  const files = findTestFiles(testDirectory);

  // The coverage include/threshold flags were introduced in Node.js 22. Fail
  // with an explicit message instead of Node's "bad option" output, and never
  // silently drop the thresholds: they are a gate.
  if (
    Number(process.versions.node.split('.')[0]) < 22 &&
    nodeArguments.some((argument) => argument.startsWith('--test-coverage-'))
  ) {
    console.error(
      `Coverage thresholds require Node.js 22 or newer; running ${process.versions.node}.`,
    );
    return 1;
  }

  if (files.length === 0) {
    console.error(`No *.test.js or *.test.cjs files found below ${testDirectory}.`);
    return 1;
  }

  const result = spawnSync(
    process.execPath,
    [...nodeArguments, '--test', ...files],
    { cwd: root, stdio: 'inherit' },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.signal) {
    console.error(`Test runner terminated by signal ${result.signal}.`);
    return 1;
  }

  return result.status ?? 1;
}

const invokedPath = process.argv[1];

if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  process.exitCode = runTests(process.argv.slice(2));
}
