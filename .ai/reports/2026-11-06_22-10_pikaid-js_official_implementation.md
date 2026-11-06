# pikaid-js — official JavaScript/TypeScript implementation

- **Repository:** `pikaid/pikaid-js` (`origin https://github.com/pikaid/pikaid-js.git`)
- **Base commit:** `7e142f0` (`docs: initialize official JavaScript and TypeScript implementation README`)
- **Specification:** pikaid canonical specification revision `1.0.4`, pinned at commit `17014d76f568c3ac9f9ce2927c1a018fdbc36d1d`
- **Reference implementation:** pikaid-php v1.2.0, pinned at commit `e3f843edeb5157a5d2d25196cac0d69580810a95`
- **Package:** `pikaid@0.1.0`, MIT, zero runtime dependencies
- **Report generated:** 2026-11-06 22:10 CET

## Summary

Implemented the complete official JavaScript and TypeScript pikaid library in
the authorized repository. The package encodes and decodes the immutable
pikaid format exactly as specified: 26 lowercase Base36 characters (7 timestamp
characters + 19 randomness characters) and an equivalent 17-byte binary form
(5-byte big-endian seconds + 12 entropy bytes). Generation uses
`globalThis.crypto.getRandomValues`, fails closed, and performs all 96-bit
arithmetic with `BigInt` rather than JavaScript `Number`.

The implementation passes every valid and invalid vector from the official PHP
v1.2.0 conformance fixture, plus independent known-answer, boundary, overflow,
zero-padding, malformed-input, randomized round-trip, ordering, generation,
CSPRNG-failure, internals, API, CommonJS, and browser suites. Local validation
produced **122 passing tests in 17 suites, 0 failures**, **99.67% line /
99.41% branch / 100% function coverage**, passing browser tests in Chromium,
Firefox, and WebKit, and a passing packaged-tarball consumer smoke test for both
ESM and CommonJS.

The repository now contains dual ESM/CJS builds with TypeScript declarations, a
GitHub Actions workflow, MIT licensing, branded documentation with accurate
publication caveats, and a reproducible packaging smoke test. Nothing was
pushed, published, released, tagged, or force-pushed. The package remains
unpublished on the npm registry.

## Requirement Coverage

### REQ-1 — Official repository and specification conformance

**Status: PASS.** The work is confined to `pikaid/pikaid-js`, whose origin was
verified as the authorized pikaid organization repository. The implementation
targets revision `1.0.4` and treats the identifier format as immutable and
unversioned. The historical `pikaid-v1.json` fixture name is documented as
historical rather than a format version.

### REQ-2 — Exact string and binary format

**Status: PASS.** Constants enforce 26 characters, 7 timestamp characters, 19
randomness characters, 17 bytes, 5 timestamp bytes, and 12 entropy bytes.
Encoding is fixed-width lowercase Base36 with left zero padding; binary is
5-byte big-endian Unix seconds followed by the unchanged 12 entropy bytes.
Maximum timestamp `78,364,164,095` and maximum randomness `2^96 − 1` are
enforced. Round-trips preserve every bit in both directions.

### REQ-3 — CSPRNG and 96-bit numeric safety

**Status: PASS.** Generation obtains exactly 12 bytes from
`globalThis.crypto.getRandomValues` and fails closed with `CRYPTO_UNAVAILABLE`
or `CRYPTO_FAILURE` when Web Crypto is missing, malformed, `null`, or throws.
There is no `Math.random` fallback. Ninety-six-bit values are handled only with
`BigInt`; no randomness value passes through `Number`. Tests assert the exact
`getRandomValues` call size and verify failure/recovery behavior.

### REQ-4 — Strict validation without normalization

**Status: PASS.** Parsing rejects non-strings, wrong lengths, uppercase or
non-ASCII characters, separators, surrounding whitespace, and entropy above
`2^96 − 1`. Binary parsing requires exactly 17 bytes and rejects 5-byte
timestamps above the format maximum. `isWellFormed` checks shape only, while
`isValid` checks shape plus semantic limits, so a 26-character string such as
`0000000zzzzzzzzzzzzzzzzzzz` is well formed but invalid. No trimming, padding,
truncation, case folding, or prefix stripping occurs.

### REQ-5 — Official vectors and independent adversarial tests

**Status: PASS.** `test/vectors/pikaid-v1.json` and its schema are verbatim
copies of the PHP v1.2.0 fixtures, with provenance recorded in
`test/vectors/README.md`. `npm test` executes every vector. Additional suites
cover independently computed known answers, carry and zero-padding boundaries,
timestamp/randomness maxima, Base36 overflow, malformed inputs, randomized
round-trips against an independent oracle, unsigned binary ordering, mixed
representations, current-era and explicit generation, CSPRNG failure, internal
`BigInt` guards, the frozen public API, and CommonJS loading.

### REQ-6 — Coverage threshold and honest reporting

**Status: PASS.** Coverage was measured from emitted ESM code under `node:test`
with enforced thresholds (lines 90, functions 90, branches 85). Actual:
**99.67% lines, 99.41% branches, 100% functions**. The only uncovered lines are
the defensive internal string-timestamp overflow check in `pikaid.js` (lines
91–92), which is unreachable because all seven Base36 timestamp digits span
exactly `0..MAX_TIMESTAMP`. Test counts above are from the final run.

### REQ-7 — Importable, documented package

**Status: PASS.** `package.json` exposes dual entry points through an exports
map (`import` → ESM, `require` → CJS, both with declarations). TypeScript
declarations are emitted for both builds and checked by
`npm run typecheck:types`, including negative `@ts-expect-error` contracts.
`LICENSE` contains MIT text with the specification copyright holder, and
`README.md` preserves the pikaid logo and tagline while documenting the API,
error codes, ordering rules, storage guidance, security caveats, browser
support, and development commands. The README and report explicitly state that
the package **has not been published to npm**; `npm view pikaid version`
returned 404. `npm run test:pack` packs the tarball, installs it into a clean
consumer, and exercises both module systems.

### REQ-8 — CI workflow

**Status: PASS (workflow authored; remote execution NOT RUN).** 
`.github/workflows/ci.yml` installs dependencies, typechecks, builds (via test
scripts), runs the test suite, checks emitted declarations, measures coverage,
runs Chromium browser tests, and runs the packaging smoke test. It defines a
Linux Node 20/22/24 matrix, Windows and macOS Node 24 jobs, a coverage job, a
Playwright Chromium job, and a packaging job. The YAML parses successfully with
Ruby Psych. It has not executed on GitHub because no push or pull request was
permitted.

### REQ-9 — Operational constraints and report delivery

**Status: PASS.** No registry publication, release, tag, force-push,
server deployment, credential use, branch-protection change, visibility change,
or unrelated repository rewrite occurred. Changes are limited to the authorized
repository, and this report is delivered to the requested Drive location with a
matching checksum.

## Root Cause or Technical Approach

pikaid has no pre-existing JavaScript implementation in this repository; the
initial commit contained only a placeholder README. The technical approach was
therefore a clean implementation rather than a bug fix:

1. **Encoding core.** Timestamp values fit safely in `Number` (maximum
   `78,364,164,095 < 2^53`), but 96-bit randomness does not. `src/base36.ts`
   therefore encodes/decodes fixed-width Base36 with `BigInt`, while
   `src/bytes.ts` converts between unsigned big-endian byte arrays and
   `BigInt` without loss.
2. **Strict decode path.** `src/pikaid.ts` validates type, exact length, ASCII
   alphabet, then computes the timestamp field and the randomness field. Shape
   validation is separated from semantic range validation so `isWellFormed`
   and `isValid` differ correctly.
3. **Generation.** `src/random.ts` resolves Web Crypto at call time, requests
   exactly 12 bytes, and wraps failures in `PikaidError` with stable codes and
   preserved causes. Invalid timestamps are rejected before consuming
   randomness.
4. **Value API.** An immutable `Pikaid` class stores the canonical string and
   lazily exposes defensive byte copies. A private module-level symbol token
   prevents JavaScript callers from bypassing factories with `new Pikaid()`.
5. **Comparison.** `compare` converts any supported representation to its
   17-byte form and compares unsigned bytes, which is equivalent to ASCII
   lexicographic order for valid strings and remains correct across mixed
   inputs. Invalid operands throw rather than producing an arbitrary order.
6. **Build and test.** TypeScript compiles twice (`dist/esm` and `dist/cjs`),
   with a CJS `package.json` marker. Tests run against the built ESM package
   through Node's self-reference resolution, and a separate `.cjs` suite loads
   the CommonJS build. A Playwright runner serves the repository over an
   ephemeral loopback server and asserts browser behavior in three engines.

## Files Changed

Build, metadata, and policy:

- `package.json` — package metadata, exports map, scripts, dev dependencies,
  coverage thresholds, `engines >=20`, zero runtime dependencies.
- `package-lock.json` — locked `typescript@5.9.3` and `playwright@1.65.0`
  dependency tree.
- `tsconfig.base.json`, `tsconfig.json`, `tsconfig.esm.json`,
  `tsconfig.cjs.json`, `tsconfig.type-tests.json` — strict TypeScript and dual
  build configuration.
- `scripts/build.mjs` — clean dual ESM/CJS compilation and CJS package marker.
- `.gitignore` — ignores build output, dependencies, coverage, tarballs, local
  run artifacts, and `.DS_Store`.
- `.github/workflows/ci.yml` — CI matrix, coverage, browser, and packaging jobs.
- `LICENSE` — MIT license.
- `README.md` — rewritten official documentation with branding and caveats.
- `logo.png` — pikaid logo used by the README, copied from the canonical
  specification materials.

Library source:

- `src/constants.ts` — format constants and maxima.
- `src/errors.ts` — `PikaidError`, stable codes, descriptive input formatting.
- `src/base36.ts` — fixed-width lowercase Base36 encode/decode primitives.
- `src/bytes.ts` — unsigned big-endian byte/`BigInt` and hex primitives.
- `src/random.ts` — runtime Web Crypto acquisition, 12-byte sampling,
  fail-closed errors.
- `src/pikaid.ts` — validation, encoding/decoding, generation, comparison,
  immutable `Pikaid` class, and public functions.
- `src/index.ts` — public export surface and types.

Tests and fixtures:

- `test/vectors/pikaid-v1.json`, `test/vectors/pikaid-v1.schema.json` —
  verbatim official PHP v1.2.0 conformance fixtures.
- `test/vectors/README.md` — provenance, pinned commits, and edit policy.
- `test/support/helpers.js` — vector loading, hex helpers, deterministic PRNG.
- `test/vectors.test.js` — every official valid/invalid vector.
- `test/known-answer.test.js` — independently computed Base36 known answers.
- `test/validation.test.js` — strict string, binary, and `fromParts` validation.
- `test/generation.test.js` — generation, explicit timestamps, clock boundaries,
  deterministic CSPRNG injection, uniqueness sampling.
- `test/crypto-failure.test.js` — missing/broken/throwing CSPRNG and recovery.
- `test/ordering.test.js` — chronological, same-second, binary, and mixed-
  representation ordering; invalid operand handling.
- `test/property.test.js` — randomized round-trips and independent oracles.
- `test/internals.test.js` — Base36/byte primitive invariants and guards.
- `test/api.test.js` — public surface, immutability, JSON, package metadata.
- `test/cjs.test.cjs` — CommonJS entry point and exports-map isolation.
- `test/browser/index.html` — in-browser conformance assertions.
- `scripts/browser-test.mjs` — ephemeral server and Playwright driver.
- `scripts/pack-smoke.mjs` — tarball creation and clean-consumer ESM/CJS test.
- `type-tests/index.ts` — compile-time declaration contracts, including
  negative assertions.

Generated `dist/` output is gitignored and is rebuilt by every test, coverage,
browser, and packaging command. No unrelated files were modified.

## Validation

Environment: macOS arm64 (Darwin), Node.js `v26.13.0`, npm `11.20.0`,
TypeScript `5.9.3`, Playwright `1.65.0`. All commands were run from
`/Users/lara/Dev/projects/pikaid-js`.

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | **PASS** | `tsc -p tsconfig.json`, no diagnostics |
| `npm test` | **PASS** | 122 tests, 17 suites, 122 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo |
| `npm run test:coverage` | **PASS** | 99.67% lines, 99.41% branches, 100% functions; thresholds 90/85/90 met |
| `npm run typecheck:types` | **PASS** | builds both targets, then checks emitted declarations and negative `@ts-expect-error` cases |
| `BROWSERS=chromium,firefox,webkit npm run test:browser` | **PASS** | Chromium `158.0.8127.18`, Firefox `159.0`, WebKit `27.2`; 8 checks per engine (24 total) |
| `npm run test:pack` | **PASS** | tarball `pikaid-0.1.0.tgz`; clean consumer ESM and CommonJS checks passed |
| `npm pack --dry-run` | **PASS** | 61 files, package size 41.3 kB, unpacked 157.7 kB; includes `dist`, `src`, `LICENSE`, `README.md`, `logo.png` |
| GitHub Actions workflow execution | **NOT RUN** | no push/PR permitted; YAML parsed successfully (jobs: test, coverage, browser, package) |
| Node.js 20 / 22 / 24 runtime matrix | **NOT RUN** | only local Node 26.13.0 was available and used |
| Windows / macOS GitHub runners | **NOT RUN** | local validation was macOS arm64 only |
| Package publication | **NOT PERFORMED** | explicitly out of scope; `npm view pikaid version` returns 404 |

Coverage detail (emitted ESM):

```text
base36.js    100.00 / 100.00 / 100.00
bytes.js     100.00 / 100.00 / 100.00
constants.js 100.00 / 100.00 / 100.00
errors.js    100.00 / 100.00 / 100.00
index.js     100.00 / 100.00 / 100.00
pikaid.js     99.47 /  99.04 / 100.00   (uncovered: 91-92)
random.js    100.00 / 100.00 / 100.00
all files     99.67 /  99.41 / 100.00
```

The single uncovered region is the internal string-timestamp overflow guard.
It is unreachable through the public API because all 7 Base36 timestamp digits
cover exactly `0..78,364,164,095`; binary timestamp overflow remains reachable
and is tested. No tests were skipped, weakened, or fabricated to raise coverage.

## Deviations and Unresolved Issues

1. **CI has not run remotely.** The workflow is complete and locally syntax-
   checked, but no push, pull request, or manual dispatch occurred. GitHub-only
   evidence is therefore `NOT RUN`.
2. **Node 20/22/24 were not executed locally.** The available runtime was Node
   26.13.0, which satisfies `engines >=20` but is outside the CI matrix. The
   local test results do not constitute proof for the older runtimes; CI is
   configured to cover them.
3. **Cross-platform CI is unverified.** Windows and macOS GitHub runner jobs are
   defined but not executed. Local validation was macOS arm64.
4. **Coverage is not 100% lines.** Two defensive lines are unreachable by
   construction (see above). This is disclosed rather than hidden.
5. **The package is unpublished and unowned on npm.** The registry returns 404
   for `pikaid`; no publication, ownership claim, or release was attempted.
   Consumers must build from source or install from the Git repository.
6. **Browser coverage in CI is Chromium-only.** Local validation exercised all
   three Playwright engines; CI intentionally limits the browser job to
   Chromium to keep the workflow practical.
7. **No monotonicity guarantee.** pikaid is sortable by timestamp and
   randomness, not monotonic within a second. Generated values within the same
   second may sort in any order, matching the specification.
8. **No unresolved functional defects.** No known correctness failures remain
   in the implemented surface.

## Final Status

```text
task_result: PASS
```

All nine requirements are implemented and locally validated. The only
unexecuted items are remote CI jobs and non-local runtime/platform matrices,
which are clearly marked `NOT RUN` and are not required to establish local
correctness. The package is complete, conformant to specification revision
1.0.4, documented, licensed, test-covered above the required threshold, and
deliberately unpublished.
