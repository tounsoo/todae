import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    // Browser tests run under vitest.browser.config.ts.
    exclude: [...configDefaults.exclude, '**/*.browser.test.tsx'],
  },
});
