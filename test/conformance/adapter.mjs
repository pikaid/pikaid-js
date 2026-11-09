/**
 * ESM JSON-Lines conformance adapter.
 *
 * Test-only. It loads the built ESM bundle of the real public package and
 * delegates every operation to it through the shared bridge core.
 *
 * Usage (from the official suite runner):
 *   node <repo>/test/conformance/adapter.mjs
 */

import * as api from '../../dist/esm/index.js';
import core from './adapter-core.cjs';

core.runAdapter(api);
