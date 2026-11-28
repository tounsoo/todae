import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { playwright } from '@vitest/browser-playwright';
import { webkit } from 'playwright';
import type { BrowserCommand } from 'vitest/node';
import { defineConfig } from 'vitest/config';
import { firefoxOnHost, webkitOnHost } from '../../playwright.host';
import { pinTestLocale, testLocaleEnv } from '../../vitest.locale';
import base from './vite.config';

if (process.env.VITEST) pinTestLocale();

/**
 * Runs `todae-tokens build --scope` on the acme fixture, or on a company layer
 * that changes nothing, adding `core` as a core set when given.
 */
const scopedThemeCss: BrowserCommand<[scope: string, options: { empty?: boolean; core?: Record<string, unknown>; brand?: Record<string, unknown> }]> = async (
  _context,
  scope,
  { empty = false, core, brand },
) => {
  const root = await mkdtemp(join(tmpdir(), 'todae-scope-'));
  try {
    const file = join(root, 'resolver.json');
    if (empty) {
      await writeFile(file, JSON.stringify({ version: '2025.10', sets: {}, modifiers: {}, resolutionOrder: [] }));
    } else {
      await cp(join(import.meta.dirname, 'scripts/__fixtures__/acme'), root, { recursive: true });
    }
    if (core || brand) {
      const resolver = JSON.parse(await readFile(file, 'utf8'));
      if (core) {
        resolver.sets.core = { sources: [core], $extensions: { 'dev.todae': { layer: 'core' } } };
        resolver.resolutionOrder.unshift({ $ref: '#/sets/core' });
      }
      if (brand) resolver.sets.brand.sources.push(brand);
      await writeFile(file, JSON.stringify(resolver));
    }
    const css = join(root, 'theme.css');
    const cli = join(import.meta.dirname, 'scripts/build-tokens.ts');
    const outputs = ['--css', css, '--catalog', join(root, 'catalog.json'), '--types', join(root, 'types.ts')];
    await promisify(execFile)(process.execPath, ['--experimental-strip-types', '--no-warnings', cli, 'build', '--resolver', file, ...(scope ? ['--scope', scope] : []), ...outputs]);
    return await readFile(css, 'utf8');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

type MediaFeature =
  | { name: 'prefers-reduced-motion'; value: 'reduce' | 'no-preference' }
  | { name: 'forced-colors'; value: 'active' | 'none' }
  | { name: 'prefers-color-scheme'; value: 'light' | 'dark' };

/**
 * Sets the media features the page reports, through Playwright so every engine
 * takes it. The list replaces the last one: a feature it leaves out goes back
 * to the page's starting value (no reduced motion, no forced colors, light),
 * not the host's, so every test starts from the same media in every engine.
 */
const emulateMedia: BrowserCommand<[features: MediaFeature[]]> = async ({ page }, features) => {
  const value = (name: MediaFeature['name']) => features.find((feature) => feature.name === name)?.value;
  await page.emulateMedia({
    reducedMotion: (value('prefers-reduced-motion') ?? 'no-preference') as 'reduce' | 'no-preference',
    forcedColors: (value('forced-colors') ?? 'none') as 'active' | 'none',
    colorScheme: (value('prefers-color-scheme') ?? 'light') as 'light' | 'dark',
  });
};

type MouseStep = { type: 'move'; x: number; y: number } | { type: 'down' } | { type: 'up' };

/**
 * Drives the real mouse through `steps`, at points in the test frame's own
 * coordinates, as `clientX` and `clientY` give them. Unlike `userEvent`, it
 * targets no element, so a press or drag lands on whatever the browser hit
 * tests there, a native scrollbar included.
 */
const mouse: BrowserCommand<[steps: MouseStep[]]> = async ({ page, iframe, frame }, steps) => {
  const box = await iframe.owner().boundingBox();
  if (!box) throw new Error('The test frame has no box');
  // Vitest scales the frame down when the page is smaller than it.
  const scale = box.width / (await (await frame()).evaluate(() => window.innerWidth));
  for (const step of steps) {
    if (step.type === 'move') await page.mouse.move(box.x + step.x * scale, box.y + step.y * scale);
    else if (step.type === 'down') await page.mouse.down();
    else await page.mouse.up();
  }
};

// Real-browser tests for what jsdom can't check: the top layer, anchor
// positioning, layout measurement and focus. Run with `pnpm test:browser`.
// Every test runs in Chromium, Firefox and WebKit, the engines README's
// browser floors name, except those gated to Chromium for its CDP session;
// `--project chromium` runs one.
export default defineConfig({
  ...base,
  // Found mid-run, these would make Vite reload the page and load a second React.
  optimizeDeps: { include: ['react/jsx-dev-runtime', 'react-dom/client', 'react-dom/server'] },
  test: {
    env: testLocaleEnv,
    include: ['src/**/*.browser.test.tsx'],
    setupFiles: ['./src/test/browser-setup.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [
        { browser: 'chromium' },
        // A page tall enough for the 414x896 test frame, so Vitest doesn't scale the frame down. Scaled,
        // Firefox snaps scroll offsets to device pixels and both engines land real input up to a pixel off.
        // Chromium keeps the default page, which its screenshots were taken in.
        // On macOS, playwright.host.ts gives Firefox a home it can start from and WebKit Linux's Tab order.
        { browser: 'firefox', provider: playwright({ launchOptions: firefoxOnHost(), contextOptions: { viewport: { width: 1280, height: 960 } } }) },
        {
          browser: 'webkit',
          provider: playwright({ launchOptions: webkitOnHost(webkit.executablePath()), contextOptions: { viewport: { width: 1280, height: 960 } } }),
        },
      ],
      commands: { scopedThemeCss, emulateMedia, mouse },
    },
  },
});
