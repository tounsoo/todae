import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import docs from '../package.json';
import designSystem from '../../../packages/design-system/package.json';

// The docs and Engines CI jobs run in Playwright's image, and its browsers fit only its own Playwright version.
it('runs the docs and Engines CI jobs in the Docker image of the pinned Playwright version', () => {
  const ci = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const version = docs.devDependencies['@playwright/test'];
  const image = `mcr.microsoft.com/playwright:v${version}-noble`;
  // Each job is the text from its two-space key to the next one.
  const jobs = new Map(
    ci
      .slice(ci.indexOf('\njobs:\n'))
      .split(/\n(?= {2}[\w-]+:\n)/)
      .slice(1)
      .map((block) => [block.slice(2, block.indexOf(':')), block]),
  );
  for (const job of ['docs', 'engines']) expect(jobs.get(job)).toContain(`\n    container: ${image}\n`);
  for (const [, other] of [...ci.matchAll(/^\s*container:[ \t]*(\S*)/gm)]) expect(other).toBe(image);
  expect(docs.devDependencies.playwright).toBe(version);
  expect(designSystem.devDependencies.playwright).toBe(version);
});
