import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import docs from '../package.json';
import designSystem from '../../../packages/design-system/package.json';

// Baselines are taken in Playwright's image, and its browsers fit only its own Playwright version.
it('runs the docs CI job in the Docker image of the pinned Playwright version', () => {
  const ci = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const version = docs.devDependencies['@playwright/test'];
  expect(ci).toContain(`container: mcr.microsoft.com/playwright:v${version}-noble`);
  expect(docs.devDependencies.playwright).toBe(version);
  expect(designSystem.devDependencies.playwright).toBe(version);
});
