import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import docs from '../package.json';
import designSystem from '../../../packages/design-system/package.json';

// The docs and Engines CI jobs run in Playwright's image, and its browsers fit only its own Playwright version.
it('runs the docs and Engines (Firefox and WebKit) CI jobs in one digest-pinned Docker image of the pinned Playwright version', () => {
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
  // Each image is pinned to a digest, so a tag pushed again can't change what runs. The digest itself
  // can't be checked here, so the two jobs have to name the same one. A version bump that keeps the old
  // digest still runs the old image, and Playwright then refuses to launch any browser that image lacks,
  // naming the image it needs.
  const pinned = new RegExp(`\\n {4}container: (${image.replaceAll('.', '\\.')}@sha256:[0-9a-f]{64})[ \\t]*(?:#.*)?\\n`);
  const [docsImage, enginesImage] = ['docs', 'engines'].map((job) => jobs.get(job)?.match(pinned)?.[1]);
  expect(docsImage).toBeDefined();
  expect(enginesImage).toBe(docsImage);
  // Both engines run in that image, so neither installs browsers or system packages from Ubuntu's mirror.
  expect(jobs.get('engines')).toMatch(/\n {8}browser: \[firefox, webkit\]\n/);
  expect(ci).not.toMatch(/playwright install(?:-deps)?\b[^\n]*\b(?:firefox|webkit)\b/);
  for (const [, other] of [...ci.matchAll(/^\s*container:[ \t]*(\S*)/gm)]) expect(other).toBe(docsImage);
  expect(docs.devDependencies.playwright).toBe(version);
  expect(designSystem.devDependencies.playwright).toBe(version);
});
