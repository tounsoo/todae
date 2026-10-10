import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [{ find: /^next\/font\/google$/, replacement: fileURLToPath(new URL('./test/nextFont.ts', import.meta.url)) }],
  },
  test: {
    setupFiles: ['./test/setup.ts'],
    // Browser tests run under vitest.browser.config.ts.
    exclude: [...configDefaults.exclude, '**/*.browser.test.tsx'],
  },
});
