# Automatic JSR publication

The npm package is `pikaid-js`; the complementary JSR package is
`@pikaid/pikaid`.

## One-time setup

1. Create or join the `@pikaid` scope at https://jsr.io/new.
2. Create package `@pikaid/pikaid`, then link it to GitHub repository
   `pikaid/pikaid-js` in its JSR settings. This authorizes OIDC publishing
   from GitHub Actions without storing a JSR token.
3. Protect release tag creation on GitHub.

## Every release

A stable `vX.Y.Z` Git tag starts
`.github/workflows/publish-jsr.yml`. It installs dependencies, runs the
existing native and type tests, copies `src/*.ts` to a temporary JSR-only
tree while converting NodeNext `.js` import specifiers to JSR-compatible
`.ts` imports, sets the JSR version from the tag, runs a JSR dry-run, then
publishes using GitHub's OIDC identity.

The npm build, CJS entrypoint and TypeScript source files are not changed by
this workflow. The generated `jsr-src/` folder must never be committed.
The original npm publishing workflow continues independently.

Use `node scripts/prepare-jsr.mjs` and `npx jsr publish --dry-run` to
reproduce the packaging validation if needed. Do not disable JSR's type or
publishing checks to work around a failure.

Reference: https://jsr.io/docs/publishing-packages
