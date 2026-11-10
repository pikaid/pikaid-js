<p align="center">
  <a href="https://github.com/pikaid/pikaid-specs">
    <img src="https://raw.githubusercontent.com/pikaid/pikaid-specs/v1.0.4/logo.png" alt="pikaid" width="300">
  </a>
</p>

<p align="center">
  <strong>Small · Sortable · Secure ID generator</strong>
</p>

<div align="center">

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![JavaScript / TypeScript](https://img.shields.io/badge/language-JavaScript%20%2F%20TypeScript-F7DF1E.svg)](https://github.com/pikaid/pikaid-js)
[![CI](https://github.com/pikaid/pikaid-js/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pikaid/pikaid-js/actions/workflows/ci.yml)
[![Official implementation](https://img.shields.io/badge/official-implementation-2e7d32.svg)](https://github.com/pikaid/pikaid-specs)
[![Specification 1.0.4](https://img.shields.io/badge/spec-1.0.4-4b56a6.svg)](https://github.com/pikaid/pikaid-specs/tree/v1.0.4)

</div>

**pikaid** is the **official JavaScript / TypeScript implementation** of a compact, chronologically sortable, collision-resistant identifier format for databases, APIs, and distributed systems.

This is the immutable, unversioned [pikaid format](https://github.com/pikaid/pikaid-specs/tree/v1.0.4), documented in specification revision **1.0.4**.

## ✨ Why pikaid?

- **Short:** Compact, readable IDs for URLs, logs, and API resources.
- **Sortable:** Lexicographically ordered by timestamp, with **one-second precision**.
- **Collision-resistant:** 96 bits of cryptographic randomness make collisions extremely unlikely, never impossible.
- **Storage-friendly:** Use `BINARY(17)` or readable `CHAR(26)`.
- **Distributed-friendly:** No central sequence generator or coordination required.

## 🧬 Identifier format

A pikaid contains **26 lowercase Base36 characters**: a **7-character Unix-seconds timestamp** followed by **19 characters encoding 96 bits of cryptographic randomness**. Its binary form is **17 bytes**: 5 unsigned big-endian timestamp bytes followed by 12 randomness bytes.

![Identifier structure](https://raw.githubusercontent.com/pikaid/pikaid-specs/v1.0.4/structure.svg)

> **Ordering:** Different seconds sort chronologically. Within the same second, randomness—not issuance order—decides the order.

> **Security:** These are identifiers, **not secrets**, session credentials, authentication tokens, or API keys.

## ⚙️ Requirements

Node.js 22+ or a modern browser with Web Crypto. The package has no runtime dependencies.

The package uses `globalThis.crypto.getRandomValues` and standard ECMAScript
features. Continuous integration exercises the built package in Chromium,
Firefox, and WebKit through Playwright.

## 📦 Installation

The npm registry package is not assumed to be published. Build from this repository first:

```sh
git clone https://github.com/pikaid/pikaid-js.git
cd pikaid-js
npm install
npm run build
```

From your **separate consumer project**, install the built local package with `npm install /absolute/path/to/pikaid-js`. Its package name is `pikaid`.

## 🚀 Basic Usage

Save this as `main.mjs` in that consumer project, then run `node main.mjs`:

```js
import { generate, parse, isValid, toBinary, fromBinary } from 'pikaid';

const id = generate();
const bytes = toBinary(id);
if (!isValid(id) || bytes.length !== 17 || fromBinary(bytes) !== id) {
  throw new Error('Pikaid round-trip failed');
}
console.log(id, parse(id).timestamp);
```

## 💡 Example Use Case

Use pikaid to identify **users, orders, invoices, uploads, events, and API resources**. Independent services can generate compact IDs without a shared counter, while timestamp-based ordering helps with indexing, sorting, and logs.

## 📚 Canonical specification

- [Canonical specification](https://github.com/pikaid/pikaid-specs)
- [Revision 1.0.4](https://github.com/pikaid/pikaid-specs/tree/v1.0.4)

Specification revisions describe the format; they do not change the encoded identifiers.

## 🧩 API Reference

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

## 🔄 Order Guarantee

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

## 🛢 Storage Recommendations

| Representation | Size | Recommended for |
| --- | ---: | --- |
| **BINARY(17)** | 17 bytes | Compact primary keys and indexes |
| **CHAR(26)** | 26 characters | Readable SQL, debugging, URLs, and logs |

Use an **ASCII bytewise/binary collation** for text columns (for example, `ascii_bin` on MariaDB/MySQL). Case-insensitive or locale-aware sorting is not a substitute for canonical bytewise comparison.

## ✅ Verification and release status

The [CI workflow](https://github.com/pikaid/pikaid-js/actions/workflows/ci.yml) runs native tests, pinned automated conformance checks, and language-specific quality gates. To run the native checks locally from a checkout, use `npm test`.

**Automated passing tests are not a security certification.** The independent CSPRNG source and failure-path audits (`P-GENERATE-RNG-SOURCE` and `P-GENERATE-RNG-FAILURE`) still require separate human evidence.

<details>
<summary>Platform, tooling, and conformance details</summary>

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

</details>

Registry publication is not implied by a green CI: use the installation method documented above.

## 🤝 Contributing

Contributions are always welcome! 💙

Whether you're fixing a typo, improving documentation, adding tests, or making pikaid even better, every contribution is appreciated.

**Want to help? Here's how:**

- 🐛 **Found a bug?** [Open an issue](https://github.com/pikaid/pikaid-js/issues) with clear reproduction steps.
- 💡 **Have an idea?** Start with an issue before making major changes.
- 🛠️ **Ready to contribute?** Open a pull request explaining your changes.
- 🧪 **Keep it tested.** Add meaningful regression tests for behavior changes and follow the existing conventions.
- ✅ **Make sure CI passes.** All required checks must be green before a pull request is merged. No shortcuts!

**One important rule:** pikaid's identifier format is immutable. Contributions must preserve the [canonical specification (revision 1.0.4)](https://github.com/pikaid/pikaid-specs/tree/v1.0.4).

🔐 **Found a security vulnerability?** Report it privately using GitHub's security reporting (when available), or [contact the maintainer](mailto:larananas.dev@proton.me)—not through a public issue.

**Every improvement matters, big or small. Thanks for helping make pikaid better!** 🐇

## 📄 License

The implementation is available under the [MIT License](LICENSE).

## ✉️ Contact

For licensing or project-related questions: [larananas.dev@proton.me](mailto:larananas.dev@proton.me).

