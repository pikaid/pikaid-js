/**
 * CommonJS JSON-Lines conformance adapter.
 *
 * Test-only. It loads the built CommonJS bundle of the real public package and
 * delegates every operation to it through the shared bridge core. Running the
 * official suite twice, once per entry point, proves both module formats expose
 * identical behaviour.
 *
 * Usage (from the official suite runner):
 *   node <repo>/test/conformance/adapter.cjs
 */

'use strict';

const api = require('../../dist/cjs/index.js');
const { runAdapter } = require('./adapter-core.cjs');

runAdapter(api);
