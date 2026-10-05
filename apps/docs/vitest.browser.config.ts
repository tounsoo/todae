import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (path: string) => fileURLToPath(new URL(`../../packages/design-system/src/${path}`, import.meta.url));

// Runs every docs demo in headless Chromium against the package source.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: /^@tounsoo\/todae\/todae\.css$/, replacement: src('styles/todae.css') },
      { find: /^@tounsoo\/todae$/, replacement: src('index.ts') },
    ],
  },
  css: { modules: { generateScopedName: 'todae_[local]_[hash:hex:6]' } },
  test: {
    include: ['**/*.browser.test.tsx'],
    exclude: ['**/node_modules/**', '.next/**'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
});
