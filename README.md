<p align="center">
  <img src="logo.png" alt="pikaid logo" width="230">
</p>

# pikaid for JavaScript and TypeScript

<p align="center"><strong>Small · Sortable · Secure IDs</strong></p>

The official JavaScript and TypeScript implementation of **pikaid**, conformant
with canonical specification revision **1.0.4**.

A pikaid is a **26-character lowercase Base36 identifier**: a 7-character Unix
timestamp in seconds followed by 19 characters encoding **96 bits of
cryptographic randomness**. Every identifier also has an equivalent **17-byte
binary form** for compact storage.

```text
0s44we8002loz3po6mcf6vsn23
└─────┘└─────────────────┘
  7             19
timestamp     randomness
```

## Status

- Specification: pikaid **1.0.4** (pinned at commit
  `17014d76f568c3ac9f9ce2927c1a018fdbc36d1d`).
- Conformance: every automated check in the official PikaID conformance suite
  (`pikaid/pikaid-specs`, package revision **1.0.0**, spec revision **1.0.4**,
  status `OFFICIAL`, pinned at commit
  `059780cc0e5b113443812720d95c630649bf3aa3`) passes for both the ESM and
  CommonJS entry points: 596 valid, 258 invalid-string, 33 invalid-binary,
  186 ordering, 12 generation, and 15 properties cases. The copied PHP v1.2.0
  fixture bytes in `test/vectors/` remain as an offline auxiliary regression,
  pinned by SHA-256 (`b0c9dfdd063613424414fef5c9065fbd2f81d645d0ab42b34e27cde715613500`;
  schema `4441d4dbaa6c5450ae9cbfb2438c53bc0421bba2b7fcc9ef9b158e5d1de0759e`), and an
  independent test re-derives every value without importing the implementation.
- Release: source version **1.0.0** is prepared. There is no published npm
  package, git tag, or GitHub release yet.
- **This package has not been published to npm.** Ownership of the `pikaid`
  name on the public registry has not been verified with authorized npm
  credentials, and this repository is private. Build it from source until an
  official publication is announced.

## Install

From a checkout:

```sh
npm install
npm run build
```

Then use the package from another local project with a file dependency, or
`npm install /path/to/pikaid-js`.

Requires **Node.js 22 or newer**. Node.js 22 is in maintenance until
2027-04-30; Node.js 24 and 26 are recommended. Modern browsers with Web Crypto
are supported. The package has **zero runtime dependencies**.

## Usage

### ESM

```js
import {
  generate,
  generateAt,
  parse,
  isValid,
  toBinary,
  fromBinary,
  timestampOf,
  compare,
} from 'pikaid';

const id = generate();
// '0s44we8002loz3po6mcf6vsn23' (example shape)

parse(id).timestamp;        // number, Unix seconds
parse(id).randomness;       // Uint8Array(12), defensive copy
timestampOf(id);            // number

const bytes = toBinary(id); // Uint8Array(17)
fromBinary(bytes);          // same 26-character string

generateAt(1_700_000_000);  // explicit timestamp
isValid(id);                // true
compare(a, b);              // -1 | 0 | 1
```

### CommonJS

```js
const {
  generate,
  parse,
  isValid,
  PikaidError,
} = require('pikaid');

const id = generate();
console.log(parse(id).id, isValid(id));
```

### TypeScript

Types ship with the package. Both `import` and `require` resolution are
supported through the export map, including `node16`/`nodenext` module
resolution.

```ts
import { Pikaid, type PikaidLike } from 'pikaid';

const value: Pikaid = Pikaid.parse('0s44we8002loz3po6mcf6vsn23');
const accepted: PikaidLike[] = [value, value.id, value.toBinary()];
```

## API

### Generation

| Function | Description |
| --- | --- |
| `generate(): string` | Generate from the current Unix second and CSPRNG randomness. |
| `generateAt(timestamp: number): string` | Generate at an explicit timestamp (seconds). |
| `generateBinary(): Uint8Array` | 17-byte binary form at the current second. |
| `generateBinaryAt(timestamp: number): Uint8Array` | 17-byte binary form at an explicit timestamp. |
| `fromParts(timestamp: number, randomness: Uint8Array): string` | Deterministic construction from a 12-byte randomness value. The input is copied. |

Generation uses `globalThis.crypto.getRandomValues`. It **fails closed** with
`CRYPTO_UNAVAILABLE` or `CRYPTO_FAILURE` when secure randomness is unavailable;
it never falls back to `Math.random`. Invalid or out-of-range timestamps are
rejected with `TIMESTAMP_OUT_OF_RANGE`.

### Parsing and validation

| Function | Description |
| --- | --- |
| `parse(value: unknown): Pikaid` | Strictly parse a string; throws `PikaidError` on invalid input. |
| `Pikaid.fromBinary(value: Uint8Array): Pikaid` | Strictly decode exactly 17 bytes. |
| `Pikaid.fromParts(timestamp, randomness)` | Strict deterministic construction. |
| `isValid(value: unknown): boolean` | `true` only for values that satisfy both shape and semantic limits. |
| `isWellFormed(value: unknown): boolean` | `true` only for the 26-character lowercase Base36 **shape**. |
| `timestampOf(value: string): number` | Decode the timestamp field. |
| `randomnessOf(value: string): Uint8Array` | Decode a defensive copy of the 12 randomness bytes. |
| `toBinary(value: string): Uint8Array` | Encode the 17-byte binary form. |
| `fromBinary(value: Uint8Array): string` | Decode the 17-byte binary form. |
| `compare(a, b): -1 \| 0 \| 1` | Compare any supported representations. |

`isWellFormed` and `isValid` are deliberately different. A string such as
`0000000zzzzzzzzzzzzzzzzzzz` has the correct shape but encodes randomness above
`2^96 - 1`, so `isWellFormed` is `true` while `isValid` is `false`.

Validation never trims, pads, truncates, or otherwise normalizes input. Uppercase
letters, whitespace, prefixes, suffixes, separators, and data URLs are rejected
as-is.

### The `Pikaid` value class

```ts
class Pikaid {
  readonly id: string;
  readonly timestamp: number;
  readonly randomness: Uint8Array;      // defensive copy
  readonly randomnessHex: string;

  static parse(value: unknown): Pikaid;
  static fromBinary(value: Uint8Array): Pikaid;
  static fromParts(timestamp: number, randomness: Uint8Array): Pikaid;
  static generate(): Pikaid;
  static generateAt(timestamp: number): Pikaid;
  static compare(a: PikaidLike, b: PikaidLike): -1 | 0 | 1;

  toBinary(): Uint8Array;
  compare(other: PikaidLike): -1 | 0 | 1;
  equals(other: PikaidLike): boolean;
  toJSON(): string;
  toString(): string;
}
```

`Pikaid` instances are immutable. Direct construction with `new Pikaid()` is not
part of the public API and throws.

### Constants

| Constant | Value |
| --- | --- |
| `ID_LENGTH` | `26` |
| `TIMESTAMP_CHARS` | `7` |
| `RANDOMNESS_CHARS` | `19` |
| `BINARY_LENGTH` | `17` |
| `TIMESTAMP_BYTES` | `5` |
| `RANDOMNESS_BYTES` | `12` |
| `MAX_TIMESTAMP` | `78364164095` (Unix seconds; year 4453) |
| `MAX_RANDOMNESS` | `2^96 - 1` as a `bigint` |

Ninety-six bits cannot be represented exactly by a JavaScript `number`.
`MAX_RANDOMNESS` is therefore a `bigint`, and the implementation never converts
randomness through `Number`.

### Errors

All operational failures are `PikaidError` instances with a stable `code`:

| Code | Meaning |
| --- | --- |
| `INVALID_TYPE` | Wrong JavaScript type for the representation. |
| `INVALID_LENGTH` | Wrong string length (26) or binary length (17). |
| `INVALID_CHARACTER` | Character outside `0123456789abcdefghijklmnopqrstuvwxyz`. |
| `TIMESTAMP_OUT_OF_RANGE` | Timestamp is not an integer in `0..MAX_TIMESTAMP`. |
| `TIMESTAMP_OVERFLOW` | Binary timestamp exceeds `MAX_TIMESTAMP`. |
| `RANDOMNESS_OVERFLOW` | Encoded randomness exceeds `2^96 - 1`. |
| `INVALID_RANDOMNESS_LENGTH` | Randomness is not exactly 12 bytes. |
| `CRYPTO_UNAVAILABLE` | Web Crypto is missing or has no `getRandomValues`. |
| `CRYPTO_FAILURE` | The platform CSPRNG threw; the original error is in `cause`. |

## Ordering and storage

The string form is fixed-width lowercase Base36, so plain ASCII/bytewise
comparison orders values chronologically by timestamp, then by randomness.

- **String column:** use a binary or otherwise verified ASCII-compatible
  collation. Case-insensitive or punctuation-insensitive database collations are
  **not** safe.
- **Binary column:** use `BINARY(17)` (or equivalent) with unsigned bytewise
  comparison.
- Values with different timestamps are never equal. Values in the same second
  differ only by randomness; pikaid does **not** guarantee uniqueness. Enforce a
  primary key or unique constraint when uniqueness matters.

## Security notes

- pikaid provides **96 bits of CSPRNG randomness** per identifier. It is not a
  secret, capability token, or authentication mechanism.
- The timestamp is readable by anyone holding the identifier. Do not use pikaid
  where leaking creation time is unacceptable.
- There is no checksum. A typo can produce another valid identifier; validate
  references against authoritative data.
- The 19-character encoding space is larger than the 96-bit randomness space.
  Strings above `2^96 - 1` are well formed but invalid, and are rejected.

## Browser support

The package uses `globalThis.crypto.getRandomValues` and standard ECMAScript
features. Continuous integration exercises the built package in Chromium,
Firefox, and WebKit through Playwright.

## Development

```sh
npm install
npm run typecheck        # strict TypeScript checking
npm run build            # dual ESM + CommonJS + declarations
npm test                 # build, then node:test suites
npm run test:coverage    # Node.js 22+; node:test coverage with enforced thresholds
npm run typecheck:types  # compile-time contract tests against emitted d.ts
npm run test:browser     # Playwright: Chromium, Firefox, WebKit
npm run test:pack        # npm tarball contents and packed ESM/CJS consumers
npm run test:archive     # git archive hygiene against a committed ref
npm run test:official    # pinned official PikaID conformance suite (needs Python 3.11+)
```

`npm run test:official` fetches `pikaid/pikaid-specs` at the exact committed
revision into the ignored `.ai/run/` directory, verifies the fixture package
identity and integrity, runs the suite's own negative-control self-tests and
independent Node.js oracle, builds this package, and runs the JSON-Lines adapter
through both module entry points. It exits 0 only when every automated check
passes. The runner still records the CSPRNG source and failure-path reviews as
outstanding manual audits: an automated pass is **not** a conformance
certification.

Conformance fixtures for the auxiliary offline regression live in
`test/vectors/`; see [`test/vectors/README.md`](test/vectors/README.md) for
provenance. The authoritative conformance gate is the pinned upstream suite, not
those copied fixtures.

## License

MIT. See [LICENSE](LICENSE).

pikaid is specified by the pikaid project. This implementation is independent of
the PHP implementation but shares its conformance vectors.
