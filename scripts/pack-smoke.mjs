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

  const packJson = run(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
    'pack',
    '--json',
    '--pack-destination',
    tarballDir,
  ]);

  const tarballs = readdirSync(tarballDir).filter((name) => name.endsWith('.tgz'));
  if (tarballs.length !== 1) {
    throw new Error(`Expected exactly one tarball, found ${tarballs.length}`);
  }

  const tarball = path.join(tarballDir, tarballs[0]);

  // `.gitignore` alone does not exclude a file from the published tarball: npm
  // always includes some files (package.json, README, LICENSE) and honours the
  // `files` field for the rest. Assert against npm's own manifest so a tracked
  // or ignored local artifact can never silently ship.
  let packedFiles;
  try {
    // `prepack` writes build output to stdout before npm emits the JSON
    // manifest, so start at the line that opens the JSON array.
    const lines = packJson.split(/\r?\n/);
    const start = lines.findIndex((line) => line.trim() === '[');
    const [packResult] = JSON.parse(lines.slice(start).join('\n'));
    packedFiles = packResult.files.map((entry) => entry.path.split(path.sep).join('/'));
  } catch (error) {
    throw new Error(`Could not read npm pack manifest: ${error.message}`);
  }

  const forbiddenPatterns = [
    /(^|\/)\.ai(\/|$)/,
    /(^|\/)node_modules(\/|$)/,
    /(^|\/)coverage(\/|$)/,
    /(^|\/)test-results(\/|$)/,
    /(^|\/)playwright-report(\/|$)/,
    /(^|\/)\.DS_Store$/,
    /\.tgz$/,
  ];

  const forbidden = packedFiles.filter((file) =>
    forbiddenPatterns.some((pattern) => pattern.test(file)),
  );

  if (forbidden.length > 0) {
    throw new Error(`Forbidden local-only files were packaged: ${forbidden.join(', ')}`);
  }

  const requiredFiles = [
    'package.json',
    'LICENSE',
    'README.md',
    'dist/esm/index.js',
    'dist/esm/index.d.ts',
    'dist/cjs/index.js',
    'dist/cjs/index.d.ts',
  ];

  for (const required of requiredFiles) {
    if (!packedFiles.includes(required)) {
      throw new Error(`Required file missing from tarball: ${required}`);
    }
  }

  console.log(`PACK CONTENTS OK (${packedFiles.length} files)`);

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
    import {
      MAX_TIMESTAMP,
      Pikaid,
      compare,
      fromBinary,
      generate,
      generateAt,
      isValid,
      isWellFormed,
      parse,
      timestampOf,
      toBinary,
    } from 'pikaid';

    const FIXTURE = '0s44we8002loz3po6mcf6vsn23';
    const FIXTURE_BINARY = '006553f10000112233445566778899aabb';
    const FIXTURE_TIMESTAMP = 1700000000;

    // README example flow.
    const generated = generate();
    if (!isValid(generated) || generated.length !== 26) throw new Error('generated id is invalid');
    if (parse(generated).randomness.length !== 12) throw new Error('randomness length is wrong');
    const bytes = toBinary(generated);
    if (fromBinary(bytes) !== generated) throw new Error('binary round-trip failed');
    const at = generateAt(1700000000);
    if (timestampOf(at) !== 1700000000) throw new Error('generateAt timestamp mismatch');
    if (compare(generateAt(1), generateAt(2)) !== -1) throw new Error('compare is not canonical');

    // Official fixture parity, independent of the implementation's encoder.
    const fixtureBinary = Buffer.from(toBinary(FIXTURE)).toString('hex');
    if (fixtureBinary !== FIXTURE_BINARY) throw new Error('fixture binary mismatch');
    if (fromBinary(Buffer.from(FIXTURE_BINARY, 'hex')) !== FIXTURE) throw new Error('fixture round-trip failed');
    if (timestampOf(FIXTURE) !== FIXTURE_TIMESTAMP) throw new Error('fixture timestamp mismatch');
    if (!isWellFormed(FIXTURE) || !isValid(FIXTURE)) throw new Error('fixture is not valid');
    if (Pikaid.fromBinary(Buffer.from(FIXTURE_BINARY, 'hex')).id !== FIXTURE) throw new Error('fixture class mismatch');
    if (MAX_TIMESTAMP !== 78364164095) throw new Error('constant mismatch');

    console.log(JSON.stringify({
      id: FIXTURE,
      timestamp: timestampOf(FIXTURE),
      binary: fixtureBinary,
      roundTrip: fromBinary(toBinary(FIXTURE)),
      wellFormed: isWellFormed(FIXTURE),
      valid: isValid(FIXTURE),
    }));
  `], { cwd: consumerDir });

  const cjs = run(process.execPath, ['-e', `
    const {
      MAX_TIMESTAMP,
      Pikaid,
      compare,
      fromBinary,
      generate,
      generateAt,
      isValid,
      isWellFormed,
      parse,
      timestampOf,
      toBinary,
    } = require('pikaid');

    const FIXTURE = '0s44we8002loz3po6mcf6vsn23';
    const FIXTURE_BINARY = '006553f10000112233445566778899aabb';
    const FIXTURE_TIMESTAMP = 1700000000;

    const generated = generate();
    if (!isValid(generated) || generated.length !== 26) throw new Error('generated id is invalid');
    if (parse(generated).randomness.length !== 12) throw new Error('randomness length is wrong');
    if (fromBinary(toBinary(generated)) !== generated) throw new Error('binary round-trip failed');
    if (timestampOf(generateAt(1700000000)) !== 1700000000) throw new Error('generateAt timestamp mismatch');
    if (compare(generateAt(1), generateAt(2)) !== -1) throw new Error('compare is not canonical');

    const fixtureBinary = Buffer.from(toBinary(FIXTURE)).toString('hex');
    if (fixtureBinary !== FIXTURE_BINARY) throw new Error('fixture binary mismatch');
    if (fromBinary(Buffer.from(FIXTURE_BINARY, 'hex')) !== FIXTURE) throw new Error('fixture round-trip failed');
    if (timestampOf(FIXTURE) !== FIXTURE_TIMESTAMP) throw new Error('fixture timestamp mismatch');
    if (!isWellFormed(FIXTURE) || !isValid(FIXTURE)) throw new Error('fixture is not valid');
    if (Pikaid.fromBinary(Buffer.from(FIXTURE_BINARY, 'hex')).id !== FIXTURE) throw new Error('fixture class mismatch');
    if (MAX_TIMESTAMP !== 78364164095) throw new Error('constant mismatch');

    console.log(JSON.stringify({
      id: FIXTURE,
      timestamp: timestampOf(FIXTURE),
      binary: fixtureBinary,
      roundTrip: fromBinary(toBinary(FIXTURE)),
      wellFormed: isWellFormed(FIXTURE),
      valid: isValid(FIXTURE),
    }));
  `], { cwd: consumerDir });

  if (esm.trim() !== cjs.trim()) {
    throw new Error(`ESM and CommonJS fixture output differs:\nESM: ${esm}\nCJS: ${cjs}`);
  }

  // Type-check the packed declarations under both export conditions. The
  // repository's own type tests use a self-reference, so this is the only check
  // that proves a real consumer sees the published `import` and `require` types.
  const consumerTypes = `
import {
  MAX_RANDOMNESS,
  Pikaid,
  generate,
  generateAt,
  toBinary,
  type PikaidLike,
} from 'pikaid';

const value: Pikaid = Pikaid.parse(generate());
const like: PikaidLike[] = [value, value.id, toBinary(value.id)];
const maximum: bigint = MAX_RANDOMNESS;

const documented: Pikaid = Pikaid.parse('0s44we8002loz3po6mcf6vsn23');
const documentedAccepted: PikaidLike[] = [documented, documented.id, documented.toBinary()];

// @ts-expect-error timestamps are numbers, not strings
generateAt('1700000000');

// @ts-expect-error the string form is required here
toBinary([0, 1]);

void [like, maximum, documentedAccepted];
`;

  writeFileSync(path.join(consumerDir, 'consumer.mts'), consumerTypes);
  writeFileSync(path.join(consumerDir, 'consumer.cts'), consumerTypes);
  writeFileSync(
    path.join(consumerDir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022'],
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
        },
        include: ['consumer.mts', 'consumer.cts'],
      },
      null,
      2,
    )}\n`,
  );

  run(
    path.join(
      root,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
    ),
    ['-p', 'tsconfig.json'],
    { cwd: consumerDir, shell: process.platform === 'win32' },
  );

  console.log('ESM consumer OK');
  console.log('CommonJS consumer OK');
  console.log('ESM/CJS fixture parity OK');
  console.log('Type declarations (ESM + CJS) OK');
  console.log(`PACKAGING PASS (${tarballs[0]})`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
