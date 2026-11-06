import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import docs from '../package.json';
import designSystem from '../../../packages/design-system/package.json';

// The docs and Engines CI jobs run in Playwright's image, and its browsers fit only its own Playwright version.
it('runs every Playwright CI job in the Docker image of the pinned Playwright version', () => {
  const ci = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const version = docs.devDependencies['@playwright/test'];
  const images = [...ci.matchAll(/^\s*container:\s*(\S+)/gm)].map((match) => match[1]);
  expect(images.length).toBeGreaterThan(0);
  for (const image of images) expect(image).toBe(`mcr.microsoft.com/playwright:v${version}-noble`);
  expect(docs.devDependencies.playwright).toBe(version);
  expect(designSystem.devDependencies.playwright).toBe(version);
});
