/**
 * Prepare an isolated TypeScript source tree for JSR without changing the
 * NodeNext .js import specifiers used by the npm distribution.
 */
import { readdirSync, readFileSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'src');
const outputDir = path.join(root, 'jsr-src');
const manifestPath = path.join(root, 'jsr.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const sourceFiles = readdirSync(sourceDir).filter((name) => name.endsWith('.ts'));

if (!sourceFiles.includes('index.ts')) {
  throw new Error('Missing TypeScript entrypoint src/index.ts');
}

const releaseTag = process.env.RELEASE_TAG;
if (releaseTag !== undefined && releaseTag !== '') {
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(releaseTag)) {
    throw new Error(`Invalid stable release tag: ${releaseTag}`);
  }
  manifest.version = releaseTag.slice(1);
}

if (manifest.name !== '@pikaid/pikaid' || manifest.exports !== './jsr-src/index.ts') {
  throw new Error('Unexpected JSR package configuration');
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const file of sourceFiles) {
  const input = readFileSync(path.join(sourceDir, file), 'utf8');
  const rewritten = input.replace(
    /(from\s+['"])(\.\/[^'"]+)\.js(['"])/g,
    (_, prefix, relative, suffix) => {
      if (!existsSync(path.resolve(sourceDir, relative + '.ts'))) {
        throw new Error(`Unresolvable TypeScript import in ${file}: ${relative}.js`);
      }
      return prefix + relative + '.ts' + suffix;
    },
  );
  if (/from\s+['"]\.\/[^'"]+\.js['"]/.test(rewritten)) {
    throw new Error(`NodeNext-only relative import remains in ${file}`);
  }
  writeFileSync(path.join(outputDir, file), rewritten);
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${sourceFiles.length} JSR TypeScript modules for ${manifest.name}@${manifest.version}`);
