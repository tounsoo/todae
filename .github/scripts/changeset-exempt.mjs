// Exits 0 when the only file under the published package that the changeset check counts is its package.json,
// that file changed only in devDependencies the build never reads, and the pull request touches nothing in
// .changeset/ but its README. Such a pull request, like most Dependabot updates of test tools, ships nothing and needs no changeset.
// Exits 1 otherwise, and the Changeset step runs `changeset status` as usual, which also checks any changeset the
// pull request brings.
// Usage: node .github/scripts/changeset-exempt.mjs <base ref>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const pkgDir = 'packages/design-system';
const manifest = `${pkgDir}/package.json`;

// The devDependencies only the tests run. Anything else may reach what ships: Vite builds dist, and TypeScript
// writes the published .d.ts files from the @types packages, which inline their types. A dependency missing from
// this list needs a changeset, so add one here only when nothing under src/ outside the tests, nor the build,
// imports it.
export const testOnly = ['vitest', '@vitest/*', '@testing-library/*', 'jsdom', 'axe-core', 'playwright', 'esbuild', 'temporal-polyfill'];

// The files changeset status counts for the package: those under it matching a pattern in changedFilePatterns
// and none of its negated ones, with paths relative to the package. `**` and its negations are all the config uses.
export function counted(files, patterns) {
  const include = patterns.filter((pattern) => !pattern.startsWith('!'));
  const exclude = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1));
  return files
    .filter((file) => file.startsWith(`${pkgDir}/`))
    .filter((file) => {
      const local = file.slice(pkgDir.length + 1);
      return include.some((pattern) => matchesGlob(local, pattern)) && !exclude.some((pattern) => matchesGlob(local, pattern));
    });
}

// True when the two package.json texts differ only in devDependencies the tests alone use. Key order counts
// outside devDependencies, since Node and TypeScript resolve `exports` conditions in the order they're written.
export function onlyDevDependencies(before, after) {
  const split = (text) => {
    const { devDependencies = {}, ...rest } = JSON.parse(text);
    return { dev: devDependencies, rest: JSON.stringify(rest) };
  };
  const a = split(before);
  const b = split(after);
  if (a.rest !== b.rest) return false;
  const changed = [...new Set([...Object.keys(a.dev), ...Object.keys(b.dev)])].filter((name) => a.dev[name] !== b.dev[name]);
  return changed.every((name) => testOnly.some((pattern) => matchesGlob(name, pattern)));
}

// `files` lists every path the pull request changed under the package and under .changeset/.
export function exempt(files, patterns, before, after) {
  // changeset status also checks the changesets and the config, so a pull request that touches either runs it.
  if (files.some((file) => file.startsWith('.changeset/') && file !== '.changeset/README.md')) return false;
  const changed = counted(files, patterns);
  if (changed.length !== 1 || changed[0] !== manifest) return false;
  if (before === null || after === null) return false;
  return onlyDevDependencies(before, after);
}

function main(base) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const files = git('-c', 'core.quotePath=false', 'diff', '--name-only', '--no-renames', `${base}...HEAD`, '--', `${pkgDir}/`, '.changeset/')
    .split('\n')
    .filter(Boolean);
  const { changedFilePatterns = ['**'] } = JSON.parse(readFileSync(new URL('../../.changeset/config.json', import.meta.url), 'utf8'));
  const show = (rev) => {
    try {
      return git('show', `${rev}:${manifest}`);
    } catch {
      return null;
    }
  };
  const mergeBase = git('merge-base', base, 'HEAD').trim();
  const result = exempt(files, changedFilePatterns, show(mergeBase), show('HEAD'));
  if (result) console.log(`Only devDependencies changed in ${manifest}, so no changeset is needed.`);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = process.argv[2];
  if (!base) {
    console.error('Usage: node .github/scripts/changeset-exempt.mjs <base ref>');
    process.exit(2);
  }
  process.exit(main(base) ? 0 : 1);
}
