# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The pikaid **identifier format** is immutable and unversioned. The `v1` in the
conformance fixture filename is historical; specification revisions describe the
same 26-character format.

## [Unreleased]

## [1.0.0] - 2026-11-07

### Added

- Official JavaScript and TypeScript implementation of pikaid specification
  revision 1.0.4.
- 26-character lowercase Base36 identifiers: a fixed-width 7-character UTC
  second timestamp followed by 19 characters encoding 96 bits of CSPRNG
  randomness.
- 17-byte binary encoding (5-byte big-endian timestamp + 12 entropy bytes),
  with strict overflow validation.
- Dual ESM and CommonJS builds with published TypeScript declarations for both
  export conditions.
- Strict parsing and validation (`parse`, `isValid`, `isWellFormed`,
  `timestampOf`, `randomnessOf`) with stable `PikaidError` codes.
- `Pikaid` immutable value class, `compare`, `toBinary`, `fromBinary`,
  `generate`, `generateAt`, `fromParts` and binary generation helpers.
- Official conformance vectors copied verbatim from pikaid-php v1.2.0, plus
  edge-case, property, ordering, CSPRNG-failure and cross-module tests.
- Browser round-trip suite driven by Playwright.
- Packaging smoke test that installs the packed tarball into a clean consumer
  and type-checks the published declarations under ESM and CommonJS.

### Fixed

- Test discovery is now portable across Node.js 20, 22, 24 and Windows,
  macOS and Linux. `node --test test` treated the directory as a module on
  Node.js 22 and newer.

### Notes

- This version is prepared for release but has **not** been published to the
  public npm registry. The `pikaid` package name is not owned by this
  repository.
- No runtime dependencies. Requires Node.js 20 or newer.
