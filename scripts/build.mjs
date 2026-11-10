import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
);

rmSync(path.join(root, 'dist'), { recursive: true, force: true });

for (const project of ['tsconfig.esm.json', 'tsconfig.cjs.json']) {
  const result = spawnSync(tsc, ['-p', project], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// The repository is ESM-first. Mark the CommonJS output explicitly so Node.js
// interprets dist/cjs/*.js correctly.
mkdirSync(path.join(root, 'dist', 'cjs'), { recursive: true });
writeFileSync(
  path.join(root, 'dist', 'cjs', 'package.json'),
  `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`,
);

console.log('Built ESM (dist/esm) and CommonJS (dist/cjs) outputs.');
