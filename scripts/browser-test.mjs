import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, firefox, webkit } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const engines = {
  chromium,
  firefox,
  webkit,
};

const requested = (process.env.BROWSERS ?? 'chromium,firefox,webkit')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

const unknown = requested.filter((name) => !(name in engines));

if (unknown.length > 0) {
  console.error(`Unknown browser(s): ${unknown.join(', ')}. Use chromium, firefox, or webkit.`);
  process.exit(1);
}

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
]);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(requestUrl.pathname);

    if (pathname === '/' || pathname === '/test/browser/') {
      pathname = '/test/browser/index.html';
    }

    const resolved = path.resolve(root, `.${pathname}`);

    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    const body = await readFile(resolved);
    response.writeHead(200, {
      'content-type': contentTypes.get(path.extname(resolved)) ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch (error) {
    const status = error && error.code === 'ENOENT' ? 404 : 500;
    response.writeHead(status).end(status === 404 ? 'Not found' : 'Server error');
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
let failures = 0;

try {
  for (const name of requested) {
    const browser = await engines[name].launch({ headless: true });

    try {
      const page = await browser.newPage();
      const errors = [];

      page.on('pageerror', (error) => errors.push(String(error)));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });

      await page.goto(`${origin}/test/browser/index.html`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__browserResult !== undefined, undefined, {
        timeout: 20_000,
      });

      const result = await page.evaluate(() => window.__browserResult);

      if (result.ok && errors.length === 0) {
        console.log(`PASS browser ${name} ${browser.version()} (${result.results.length} checks)`);
      } else {
        failures += 1;
        console.error(`FAIL browser ${name} ${browser.version()}`);

        for (const check of result.results) {
          if (!check.ok) {
            console.error(`  not ok - ${check.name}\n${check.error}`);
          }
        }

        for (const error of errors) {
          console.error(`  page error: ${error}`);
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

if (failures > 0) {
  console.error(`${failures} browser(s) failed.`);
  process.exit(1);
}

console.log(`All ${requested.length} browser(s) passed.`);
