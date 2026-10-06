import { defineConfig } from 'vitest/config';
import base from './vite.config';

// Real-browser tests for what jsdom can't check: the top layer, anchor
// positioning, layout measurement and focus. Run with `pnpm test:browser`.
export default defineConfig({
  ...base,
  test: {
    include: ['src/**/*.browser.test.tsx'],
    setupFiles: ['./src/test/browser-setup.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
});
