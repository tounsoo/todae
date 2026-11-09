import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { pinTestLocale, testLocaleEnv } from '../../vitest.locale';

if (process.env.VITEST) pinTestLocale();

const src = (path: string) => fileURLToPath(new URL(`../../packages/design-system/src/${path}`, import.meta.url));

// The server-safe entries (`@tounsoo/todae/stack` and the rest), so they load the same CSS modules as the main entry.
const serverEntries = readdirSync(src('server')).map((file) => file.replace(/\.ts$/, ''));

// Runs every docs demo in headless Chromium against the package source.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  // next/link reads Next's build-time env, which only Next defines.
  define: { 'process.env': '{}' },
  resolve: {
    alias: [
      { find: /^@tounsoo\/todae\/todae\.css$/, replacement: src('styles/todae.css') },
      { find: /^@tounsoo\/todae$/, replacement: src('index.ts') },
      ...serverEntries.map((name) => ({ find: new RegExp(`^@tounsoo/todae/${name}$`), replacement: src(`server/${name}.ts`) })),
    ],
  },
  // Pre-bundle what demos import, so a cold cache does not re-optimize and reload mid-run,
  // which can leave two React copies and fail hooks with a null dispatcher.
  optimizeDeps: {
    include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', 'next/navigation', 'next/link'],
  },
  css: { modules: { generateScopedName: 'todae_[local]_[hash:hex:6]' } },
  test: {
    env: testLocaleEnv,
    // Every test sees the same now, so a picker that opens at today or the next time looks the same whenever CI runs.
    // The hover fade of Button, Chip, Link and Pagination is off, so a check that reads colors right after a
    // theme change or a hover sees the colors it lands on.
    setupFiles: ['./test/fixedClock.ts', './test/noControlFade.ts'],
    include: ['**/*.browser.test.tsx'],
    exclude: ['**/node_modules/**', '.next/**'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
});
