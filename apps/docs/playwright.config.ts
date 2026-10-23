import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

// At the phone's pixel ratio, a line with inline code on the playground came out a pixel or two
// taller in about one run in ten, so its shot failed at random. Chromium positions glyphs at
// subpixels above a ratio of 1, and a page seems to lay out at times before that setting applies:
// a reload, or this switch turning it off, made every run alike. Phone shots therefore check layout
// with whole-pixel glyphs, not the exact text a phone draws. Checked on Playwright 1.56.1; if phone
// shots turn flaky after a bump, see whether Chromium still honors the switch.
const phone = { ...devices['Pixel 7'], launchOptions: { args: ['--disable-font-subpixel-positioning'] } };

// Screenshot diffs of the built docs site. Pixels depend on fonts and the Chromium build, so the
// baselines come from Playwright's Docker image, which CI runs in too: `pnpm --filter docs test:visual:docker`.
export default defineConfig({
  testDir: 'visual',
  testMatch: '*.visual.ts',
  snapshotPathTemplate: '{testDir}/baselines/{projectName}/{arg}{ext}',
  fullyParallel: true,
  // The docs CI runner has 4 cores. Playwright's default is half of them.
  workers: process.env.CI ? 4 : undefined,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' } },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    timezoneId: 'UTC',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    // Only the site pages run at phone width; ARCHITECTURE.md says why examples don't.
    { name: 'phone-light', testMatch: 'pages.visual.ts', use: { ...phone, colorScheme: 'light' } },
    { name: 'phone-dark', testMatch: 'pages.visual.ts', use: { ...phone, colorScheme: 'dark' } },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    port: PORT,
    // Always this build's server: one left running from an older build would pass stale pixels.
    reuseExistingServer: false,
  },
});
