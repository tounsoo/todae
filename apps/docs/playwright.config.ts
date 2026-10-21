import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

// At the phone's pixel ratio Chromium positions glyphs at subpixels, but a new page sometimes lays
// out before that setting reaches it, so a line with inline code comes out a pixel taller in some
// runs and the shot differs. With subpixel positioning off, every run lays out alike.
const phone = { ...devices['Pixel 7'], launchOptions: { args: ['--disable-font-subpixel-positioning'] } };

// Screenshot diffs of the built docs site. Pixels depend on fonts and the Chromium build, so the
// baselines come from Playwright's Docker image, which CI runs in too: `pnpm --filter docs test:visual:docker`.
export default defineConfig({
  testDir: 'visual',
  testMatch: '*.visual.ts',
  snapshotPathTemplate: '{testDir}/baselines/{projectName}/{arg}{ext}',
  fullyParallel: true,
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
