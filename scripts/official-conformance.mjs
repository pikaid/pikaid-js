/**
 * Run the official PikaID conformance suite against this package.
 *
 * The suite is sourced from the upstream `pikaid/pikaid-specs` repository at an
 * exact commit, never a branch or tag. The checkout lives under `.ai/run/`,
 * which is ignored by git, so the repository never vendors the fixtures.
 *
 * What this script proves, when it exits 0:
 *   - the pinned fixture package has the expected OFFICIAL identity and passes
 *     its own integrity/schema/mathematical verification;
 *   - the suite's own negative-control tests pass;
 *   - the suite's independent Node.js oracle agrees with the fixtures;
 *   - the real public package, built from this working tree, passes every
 *     automated conformance check through both the ESM and CommonJS entry
 *     points.
 *
 * What it deliberately does NOT prove: CSPRNG source review or failure-path
 * review. The runner reports those as outstanding manual audits and its own
 * output states that an automated-only pass is NOT a conformance certification.
 *
 * Exit status is 0 only when every step above succeeds. Any failure exits
 * non-zero and stops immediately.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const runDirectory = path.join(root, '.ai', 'run');
const suiteDirectory = path.join(runDirectory, 'pikaid-specs');
const conformanceDirectory = path.join(suiteDirectory, 'conformance');
const venvDirectory = path.join(runDirectory, 'venv-official');
const reportDirectory = path.join(runDirectory, 'official-conformance');

const SUITE_REPOSITORY = 'https://github.com/pikaid/pikaid-specs.git';
const SUITE_COMMIT = '059780cc0e5b113443812720d95c630649bf3aa3';
const EXPECTED_STATUS = 'OFFICIAL';
const EXPECTED_PACKAGE_REVISION = '1.0.0';
const EXPECTED_SPEC_REVISION = '1.0.4';

const EXPECTED_FIXTURE_COUNTS = Object.freeze({
  valid: 596,
  'invalid-string': 258,
  'invalid-binary': 33,
  ordering: 186,
  generation: 12,
  properties: 15,
});

class OfficialConformanceError extends Error {}

function log(message) {
  process.stdout.write(`${message}\n`);
}

/**
 * Run a command inheriting stdio. Throws on spawn failure or non-zero exit.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{cwd?: string}} [options]
 */
function run(command, args, options = {}) {
  log(`\n$ ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw new OfficialConformanceError(
      `failed to start ${command}: ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    throw new OfficialConformanceError(
      `${command} exited with status ${String(result.status)}`,
    );
  }
}

function capture(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
}

/**
 * Find an interpreter that is genuinely Python 3.11 or newer.
 *
 * @returns {{command: string, prefix: string[]}}
 */
function findPython() {
  const candidates = [];

  if (process.env.PIKAID_PYTHON) {
    candidates.push({ command: process.env.PIKAID_PYTHON, prefix: [] });
  }

  for (const version of ['3.14', '3.13', '3.12', '3.11']) {
    candidates.push({
      command: process.platform === 'win32' ? 'python' : `python${version}`,
      prefix: [],
    });
  }

  candidates.push({ command: 'python3', prefix: [] });
  candidates.push({ command: 'python', prefix: [] });
  candidates.push({ command: 'py', prefix: ['-3'] });

  for (const candidate of candidates) {
    const probe = capture(candidate.command, [
      ...candidate.prefix,
      '-c',
      'import sys; raise SystemExit(0 if sys.version_info[:2] >= (3, 11) else 1)',
    ]);

    if (probe.error === undefined && probe.status === 0) {
      const version = capture(candidate.command, [
        ...candidate.prefix,
        '-c',
        'import sys; print("%d.%d.%d" % sys.version_info[:3])',
      ]);
      log(
        `Python: ${candidate.command} ${candidate.prefix.join(' ')} -> ${version.stdout.trim()}`,
      );
      return candidate;
    }
  }

  throw new OfficialConformanceError(
    'Python 3.11 or newer is required to run the official conformance suite. ' +
      'Set PIKAID_PYTHON to a suitable interpreter.',
  );
}

function git(args, options = {}) {
  const result = capture('git', args, options);

  if (result.error) {
    throw new OfficialConformanceError(
      `failed to start git: ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    throw new OfficialConformanceError(
      `git ${args.join(' ')} failed: ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }

  return result.stdout;
}

/**
 * Ensure a clean checkout of the suite exists at exactly SUITE_COMMIT.
 */
function ensureSuiteCheckout() {
  if (existsSync(path.join(suiteDirectory, '.git'))) {
    const head = git(['-C', suiteDirectory, 'rev-parse', 'HEAD']).trim();

    if (head === SUITE_COMMIT) {
      const dirty = git(['-C', suiteDirectory, 'status', '--porcelain']).trim();

      if (dirty.length > 0) {
        throw new OfficialConformanceError(
          `pinned suite checkout has local modifications:\n${dirty}`,
        );
      }

      log(`Suite: reusing pinned checkout at ${SUITE_COMMIT}`);
      return;
    }

    log(
      `Suite: existing checkout is ${head}, expected ${SUITE_COMMIT}; replacing it`,
    );
    rmSync(suiteDirectory, { recursive: true, force: true });
  } else if (existsSync(suiteDirectory)) {
    rmSync(suiteDirectory, { recursive: true, force: true });
  }

  mkdirSync(runDirectory, { recursive: true });
  git(['init', '--quiet', suiteDirectory]);
  git(['-C', suiteDirectory, 'remote', 'add', 'origin', SUITE_REPOSITORY]);

  log(`Suite: fetching exact commit ${SUITE_COMMIT}`);
  const shallow = spawnSync(
    'git',
    ['-C', suiteDirectory, 'fetch', '--depth', '1', 'origin', SUITE_COMMIT],
    { stdio: 'inherit', env: process.env },
  );

  if (shallow.status !== 0) {
    log('Suite: shallow fetch of the exact commit failed; retrying full fetch');
    git(['-C', suiteDirectory, 'fetch', 'origin', SUITE_COMMIT]);
  }

  git(['-C', suiteDirectory, 'checkout', '--quiet', '--detach', 'FETCH_HEAD']);

  const head = git(['-C', suiteDirectory, 'rev-parse', 'HEAD']).trim();

  if (head !== SUITE_COMMIT) {
    throw new OfficialConformanceError(
      `pinned suite checkout is ${head}, expected ${SUITE_COMMIT}`,
    );
  }

  log(`Suite: checked out ${SUITE_COMMIT}`);
}

/**
 * Ensure a virtual environment with the suite's declared tooling exists.
 *
 * @param {{command: string, prefix: string[]}} python
 * @returns {string} Path to the virtual environment's interpreter.
 */
function ensureVenv(python) {
  const venvPython =
    process.platform === 'win32'
      ? path.join(venvDirectory, 'Scripts', 'python.exe')
      : path.join(venvDirectory, 'bin', 'python');

  if (!existsSync(venvPython)) {
    rmSync(venvDirectory, { recursive: true, force: true });
    run(python.command, [...python.prefix, '-m', 'venv', venvDirectory]);
  }

  const probe = capture(venvPython, ['-c', 'import jsonschema']);

  if (probe.status !== 0) {
    run(venvPython, [
      '-m',
      'pip',
      'install',
      '--quiet',
      '--disable-pip-version-check',
      '-r',
      path.join(conformanceDirectory, 'tools', 'requirements.txt'),
    ]);
  }

  return venvPython;
}

/**
 * Assert that a runner report records every automated check as passed.
 *
 * @param {string} reportPath
 * @param {string} label
 */
function assertAutomatedReport(reportPath, label) {
  let report;

  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch (error) {
    throw new OfficialConformanceError(
      `${label}: cannot read report ${reportPath}: ${error.message}`,
    );
  }

  if (report.automated_passed !== true) {
    throw new OfficialConformanceError(
      `${label}: automated_passed is ${String(report.automated_passed)}`,
    );
  }

  if (report.automated_only !== true || report.exit_code !== 0) {
    throw new OfficialConformanceError(
      `${label}: unexpected status ${String(report.status)} / exit ${String(report.exit_code)}`,
    );
  }

  if (Array.isArray(report.errors) && report.errors.length > 0) {
    throw new OfficialConformanceError(
      `${label}: runner reported errors: ${JSON.stringify(report.errors)}`,
    );
  }

  const counts = report.counts ?? {};
  const expectedNotApplicable = { properties: 2 };

  for (const [suite, expected] of Object.entries(EXPECTED_FIXTURE_COUNTS)) {
    const entry = counts[suite];

    if (!entry || typeof entry.passed !== 'number') {
      throw new OfficialConformanceError(
        `${label}: report has no result for suite "${suite}"`,
      );
    }

    if (entry.failed !== 0) {
      throw new OfficialConformanceError(
        `${label}: suite "${suite}" has ${entry.failed} failures`,
      );
    }

    const notApplicable = entry.not_applicable ?? 0;
    const total = entry.passed + notApplicable;

    if (total !== expected) {
      throw new OfficialConformanceError(
        `${label}: suite "${suite}" accounts for ${total} cases, expected ${expected}`,
      );
    }

    if (notApplicable !== (expectedNotApplicable[suite] ?? 0)) {
      throw new OfficialConformanceError(
        `${label}: suite "${suite}" has ${notApplicable} not-applicable cases, expected ${expectedNotApplicable[suite] ?? 0}`,
      );
    }
  }

  const audits = report.outstanding_audits ?? [];

  log(
    `${label}: ${report.status} (automated checks passed; outstanding manual audits: ${audits.join(', ') || 'none'})`,
  );
}

function main() {
  log('Official PikaID conformance run');
  log(`Repository: ${root}`);
  log(`Pinned suite commit: ${SUITE_COMMIT}`);
  log(`Expected: ${EXPECTED_STATUS} / package ${EXPECTED_PACKAGE_REVISION} / spec ${EXPECTED_SPEC_REVISION}`);

  ensureSuiteCheckout();
  const python = findPython();
  const venvPython = ensureVenv(python);

  log('\n== Fixture integrity and release identity ==');
  run(
    venvPython,
    [
      'tools/verify_vectors.py',
      '--expect-status',
      EXPECTED_STATUS,
      '--expect-package-revision',
      EXPECTED_PACKAGE_REVISION,
      '--expect-spec-revision',
      EXPECTED_SPEC_REVISION,
    ],
    { cwd: conformanceDirectory },
  );

  log('\n== Suite self-tests (including negative controls) ==');
  run(
    venvPython,
    ['-m', 'unittest', 'discover', '-s', 'tools/tests', '-v'],
    { cwd: conformanceDirectory },
  );

  log('\n== Independent Node.js oracle ==');
  run('node', ['tools/verify_oracle_node.mjs'], { cwd: conformanceDirectory });

  log('\n== Build the real public package ==');
  run('npm', ['run', 'build'], { cwd: root });

  mkdirSync(reportDirectory, { recursive: true });

  const adapters = [
    {
      label: 'ESM adapter',
      file: path.join(root, 'test', 'conformance', 'adapter.mjs'),
      report: path.join(reportDirectory, 'esm.json'),
    },
    {
      label: 'CommonJS adapter',
      file: path.join(root, 'test', 'conformance', 'adapter.cjs'),
      report: path.join(reportDirectory, 'cjs.json'),
    },
  ];

  for (const adapter of adapters) {
    log(`\n== Official automated conformance: ${adapter.label} ==`);
    run(
      venvPython,
      [
        'tools/run_adapter.py',
        '--automated-only',
        '--report-json',
        adapter.report,
        '--',
        process.execPath,
        adapter.file,
      ],
      { cwd: conformanceDirectory },
    );
    assertAutomatedReport(adapter.report, adapter.label);
  }

  log(
    '\nPASS: official automated conformance passed for both ESM and CommonJS entry points.',
  );
  log(
    'NOT A CERTIFICATION: CSPRNG source review and failure-path review remain outstanding manual audits.',
  );
}

try {
  main();
} catch (error) {
  if (error instanceof OfficialConformanceError) {
    process.stderr.write(`\nFAIL: ${error.message}\n`);
  } else {
    process.stderr.write(
      `\nFAIL: unexpected error: ${error instanceof Error ? error.stack : String(error)}\n`,
    );
  }

  process.exitCode = 1;
}
