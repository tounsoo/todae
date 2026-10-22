import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { BrowserCommand } from 'vitest/node';
import { defineConfig } from 'vitest/config';
import base from './vite.config';

/**
 * Runs `todae-tokens build --scope` on the acme fixture, or on a company layer
 * that changes nothing, adding `core` as a core set when given.
 */
const scopedThemeCss: BrowserCommand<[scope: string, options: { empty?: boolean; core?: Record<string, unknown> }]> = async (
  _context,
  scope,
  { empty = false, core },
) => {
  const root = await mkdtemp(join(tmpdir(), 'todae-scope-'));
  try {
    const file = join(root, 'resolver.json');
    if (empty) {
      await writeFile(file, JSON.stringify({ version: '2025.10', sets: {}, modifiers: {}, resolutionOrder: [] }));
    } else {
      await cp(join(import.meta.dirname, 'scripts/__fixtures__/acme'), root, { recursive: true });
    }
    if (core) {
      const resolver = JSON.parse(await readFile(file, 'utf8'));
      resolver.sets.core = { sources: [core], $extensions: { 'dev.todae': { layer: 'core' } } };
      resolver.resolutionOrder.unshift({ $ref: '#/sets/core' });
      await writeFile(file, JSON.stringify(resolver));
    }
    const css = join(root, 'theme.css');
    const cli = join(import.meta.dirname, 'scripts/build-tokens.ts');
    const outputs = ['--css', css, '--catalog', join(root, 'catalog.json'), '--types', join(root, 'types.ts')];
    await promisify(execFile)(process.execPath, ['--experimental-strip-types', '--no-warnings', cli, 'build', '--resolver', file, '--scope', scope, ...outputs]);
    return await readFile(css, 'utf8');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

// Real-browser tests for what jsdom can't check: the top layer, anchor
// positioning, layout measurement and focus. Run with `pnpm test:browser`.
export default defineConfig({
  ...base,
  // Found mid-run, these would make Vite reload the page and load a second React.
  optimizeDeps: { include: ['react/jsx-dev-runtime', 'react-dom/client', 'react-dom/server'] },
  test: {
    include: ['src/**/*.browser.test.tsx'],
    setupFiles: ['./src/test/browser-setup.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
      commands: { scopedThemeCss },
    },
  },
});
