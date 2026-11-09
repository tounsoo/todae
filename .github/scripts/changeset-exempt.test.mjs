import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { counted, exempt, onlyDevDependencies } from './changeset-exempt.mjs';

const { changedFilePatterns: patterns } = JSON.parse(readFileSync(new URL('../../.changeset/config.json', import.meta.url), 'utf8'));
const pkg = (fields) => JSON.stringify({ name: '@tounsoo/todae', version: '0.10.1', ...fields }, null, 2);
const manifest = 'packages/design-system/package.json';

test('tests, fixtures and test setup are not counted, as in the changeset config', () => {
  const files = [
    'packages/design-system/src/browser/a11y.browser.test.tsx',
    'packages/design-system/src/Button.test.ts',
    'packages/design-system/src/test/media.ts',
    'packages/design-system/vitest.browser.config.ts',
    'packages/design-system/CHANGELOG.md',
    'packages/design-system/scripts/__fixtures__/acme/resolver.json',
  ];
  assert.deepEqual(counted(files, patterns), []);
  assert.deepEqual(counted([...files, manifest, 'packages/design-system/src/Button.tsx'], patterns), [manifest, 'packages/design-system/src/Button.tsx']);
});

test('a devDependencies-only change to package.json is exempt', () => {
  const before = pkg({ devDependencies: { vitest: '^3.0.9' }, peerDependencies: { react: '^19.0.0' } });
  const after = pkg({ devDependencies: { vitest: '^4.1.12', '@vitest/browser-playwright': '4.1.12' }, peerDependencies: { react: '^19.0.0' } });
  assert.equal(onlyDevDependencies(before, after), true);
  assert.equal(exempt([manifest, 'packages/design-system/src/test/media.ts'], patterns, before, after), true);
});

test('any other package.json change needs a changeset', () => {
  const before = pkg({ devDependencies: { vitest: '^3.0.9' }, peerDependencies: { react: '^19.0.0' } });
  for (const after of [
    pkg({ devDependencies: { vitest: '^4.1.12' }, peerDependencies: { react: '^19.1.0' } }),
    pkg({ devDependencies: { vitest: '^4.1.12' }, peerDependencies: { react: '^19.0.0' }, dependencies: { clsx: '^2.0.0' } }),
    pkg({ version: '0.10.2', devDependencies: { vitest: '^3.0.9' }, peerDependencies: { react: '^19.0.0' } }),
  ]) {
    assert.equal(exempt([manifest], patterns, before, after), false);
  }
});

test('a shipped file beside the manifest, or no manifest change, is not exempt', () => {
  const before = pkg({ devDependencies: { vitest: '^3.0.9' } });
  const after = pkg({ devDependencies: { vitest: '^4.1.12' } });
  assert.equal(exempt([manifest, 'packages/design-system/src/Button.tsx'], patterns, before, after), false);
  assert.equal(exempt(['packages/design-system/src/Button.tsx'], patterns, before, before), false);
  assert.equal(exempt([], patterns, before, before), false);
  assert.equal(exempt([manifest], patterns, null, after), false);
  assert.equal(exempt([manifest], patterns, before, null), false);
});

test('reordering exports conditions needs a changeset, since resolution follows key order', () => {
  const before = pkg({ exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } }, devDependencies: { vitest: '^3.0.9' } });
  const after = pkg({ exports: { '.': { import: './dist/index.js', types: './dist/index.d.ts' } }, devDependencies: { vitest: '^4.1.12' } });
  assert.equal(exempt([manifest], patterns, before, after), false);
});

test('a bump of what the build reads needs a changeset: Vite, TypeScript, the @types packages, or anything unlisted', () => {
  for (const name of ['vite', 'typescript', '@types/react', '@types/node', 'react', 'some-new-tool']) {
    const before = pkg({ devDependencies: { [name]: '^6.0.0', vitest: '^4.1.12' } });
    const after = pkg({ devDependencies: { [name]: '^6.1.0', vitest: '^4.1.12' } });
    assert.equal(exempt([manifest], patterns, before, after), false, name);
  }
  const before = pkg({ devDependencies: { vitest: '^4.1.12' } });
  assert.equal(exempt([manifest], patterns, before, pkg({ devDependencies: { vitest: '^4.1.12', 'some-new-tool': '1.0.0' } })), false);
});

test('a bump of test-only tools alone is exempt', () => {
  const before = pkg({ devDependencies: { vitest: '^4.1.12', '@vitest/browser-playwright': '4.1.12', '@testing-library/react': '^16.2.0', jsdom: '^26.0.0', 'axe-core': '^4.13.0' } });
  const after = pkg({ devDependencies: { vitest: '^4.2.0', '@vitest/browser-playwright': '4.2.0', '@testing-library/react': '^16.3.0', jsdom: '^26.1.0', 'axe-core': '^4.14.0' } });
  assert.equal(exempt([manifest], patterns, before, after), true);
});

test('a pull request that adds or edits a changeset runs changeset status, which checks it', () => {
  const before = pkg({ devDependencies: { vitest: '^3.0.9' } });
  const after = pkg({ devDependencies: { vitest: '^4.1.12' } });
  assert.equal(exempt([manifest, '.changeset/bad-name.md'], patterns, before, after), false);
  assert.equal(exempt([manifest, '.changeset/README.md'], patterns, before, after), true);
  assert.equal(exempt([manifest, '.changeset/config.json'], patterns, before, after), true);
});
