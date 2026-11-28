import { configDefaults, defineConfig } from 'vitest/config';
import { pinTestLocale, testLocaleEnv } from '../../vitest.locale';

if (process.env.VITEST) pinTestLocale();

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    env: testLocaleEnv,
    setupFiles: ['./test/setup.ts'],
    // A hang guard, not a speed check: no test here asserts how fast anything runs. Several tests read and
    // compile every docs page, which takes 1.4 to 4.5 seconds on CI's 4-core runner, close to Vitest's 5-second
    // default, and 5 to 10 seconds on a laptop that is also building other checkouts. A test that hangs still
    // fails, after a minute.
    testTimeout: 60_000,
    // Browser tests run under vitest.browser.config.ts.
    exclude: [...configDefaults.exclude, '**/*.browser.test.tsx', 'peek/**'],
  },
});
