/**
 * Git source-archive hygiene check.
 *
 * `npm pack` and `git archive` select different file sets: npm follows the
 * `files` field and always-included files, while `git archive` follows tracked
 * Git content. This script archives a committed ref (default `HEAD`) and fails
 * if local-only workspace content, build output, caches, or test artifacts are
 * tracked. Run with `node scripts/archive-smoke.mjs [ref]`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ref = process.argv[2] ?? 'HEAD';
const workspace = mkdtempSync(path.join(tmpdir(), 'pikaid-archive-smoke-'));
const archive = path.join(workspace, 'source.tar');

const forbiddenPatterns = [
  /(^|\/)\.ai(\/|$)/,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)coverage(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)test-results(\/|$)/,
  /(^|\/)playwright-report(\/|$)/,
  /(^|\/)\.DS_Store$/,
  /\.tgz$/,
];

const requiredFiles = [
  'package.json',
  'package-lock.json',
  'LICENSE',
  'README.md',
  'CHANGELOG.md',
  'src/index.ts',
  'test/vectors/pikaid-v1.json',
  'test/conformance.test.js',
  '.github/workflows/ci.yml',
];

try {
  execFileSync('git', ['archive', '--format=tar', '--output', archive, ref], {
    cwd: root,
    stdio: 'pipe',
  });

  const listing = execFileSync('tar', ['-tf', archive], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  const files = listing
    .split(/\r?\n/)
    .map((entry) => entry.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const forbidden = files.filter((file) =>
    forbiddenPatterns.some((pattern) => pattern.test(file)),
  );

  if (forbidden.length > 0) {
    throw new Error(`Forbidden paths in git archive ${ref}: ${forbidden.join(', ')}`);
  }

  for (const required of requiredFiles) {
    if (!files.includes(required)) {
      throw new Error(`Required file missing from git archive ${ref}: ${required}`);
    }
  }

  console.log(`ARCHIVE CONTENTS OK (${files.length} files, ref ${ref})`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
