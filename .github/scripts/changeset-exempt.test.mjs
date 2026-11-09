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
