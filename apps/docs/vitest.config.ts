import { configDefaults, defineConfig } from 'vitest/config';
import { pinTestLocale, testLocaleEnv } from '../../vitest.locale';

if (process.env.VITEST) pinTestLocale();

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    env: testLocaleEnv,
    setupFiles: ['./test/setup.ts'],
    // Browser tests run under vitest.browser.config.ts.
    exclude: [...configDefaults.exclude, '**/*.browser.test.tsx', 'peek/**'],
  },
});
