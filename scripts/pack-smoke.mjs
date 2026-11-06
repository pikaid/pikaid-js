/**
 * Packaging smoke test.
 *
 * Packs the package exactly as npm would publish it, installs the tarball into
 * a clean consumer project, and exercises both the ESM and CommonJS entry
 * points. Run with `node scripts/pack-smoke.mjs`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = mkdtempSync(path.join(tmpdir(), 'pikaid-pack-smoke-'));
const tarballDir = path.join(workspace, 'tarball');
const consumerDir = path.join(workspace, 'consumer');

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
    ...options,
  });
}

try {
  mkdirSync(tarballDir, { recursive: true });
  mkdirSync(consumerDir, { recursive: true });

  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
    'pack',
    '--silent',
    '--pack-destination',
    tarballDir,
  ]);

  const tarballs = readdirSync(tarballDir).filter((name) => name.endsWith('.tgz'));
  if (tarballs.length !== 1) {
    throw new Error(`Expected exactly one tarball, found ${tarballs.length}`);
  }

  const tarball = path.join(tarballDir, tarballs[0]);

  writeFileSync(
    path.join(consumerDir, 'package.json'),
    `${JSON.stringify({ name: 'pikaid-smoke-consumer', private: true, version: '0.0.0' }, null, 2)}\n`,
  );

  run(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['install', '--no-audit', '--no-fund', '--ignore-scripts', tarball],
    { cwd: consumerDir },
  );

  const esm = run(process.execPath, ['--input-type=module', '-e', `
    import { generate, parse, toBinary, fromBinary, isValid, Pikaid, MAX_TIMESTAMP } from 'pikaid';
    const id = generate();
    if (!isValid(id) || id.length !== 26) throw new Error('generated id is invalid');
    const binary = toBinary(id);
    if (binary.length !== 17) throw new Error('binary length is wrong');
    if (fromBinary(binary) !== id) throw new Error('binary round-trip failed');
    if (parse(id).id !== id) throw new Error('parse mismatch');
    if (Pikaid.fromBinary(binary).timestamp !== parse(id).timestamp) throw new Error('timestamp mismatch');
    if (MAX_TIMESTAMP !== 78364164095) throw new Error('constant mismatch');
    console.log('ESM consumer OK');
  `], { cwd: consumerDir });

  const cjs = run(process.execPath, ['-e', `
    const { generate, isValid, toBinary, fromBinary } = require('pikaid');
    const id = generate();
    if (!isValid(id)) throw new Error('generated id is invalid');
    if (fromBinary(toBinary(id)) !== id) throw new Error('binary round-trip failed');
    console.log('CommonJS consumer OK');
  `], { cwd: consumerDir });

  process.stdout.write(esm);
  process.stdout.write(cjs);
  console.log(`PACKAGING PASS (${tarballs[0]})`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
