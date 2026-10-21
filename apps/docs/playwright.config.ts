import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

// Screenshot diffs of the built docs site. Pixels depend on fonts and the Chromium build, so the
// baselines come from Playwright's Docker image, which CI runs in too: `pnpm --filter docs test:visual:update`.
export default defineConfig({
  testDir: 'visual',
  testMatch: '*.visual.ts',
  snapshotPathTemplate: '{testDir}/baselines/{projectName}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // A demo that plays out on a timer, such as Attachment's upload, is shot once it stops changing.
  expect: { timeout: 10_000, toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' } },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    timezoneId: 'UTC',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    // Examples are the same at phone width except where a demo reflows, so only the site pages run there.
    { name: 'phone-light', testMatch: 'pages.visual.ts', use: { ...devices['Pixel 7'], colorScheme: 'light' } },
    { name: 'phone-dark', testMatch: 'pages.visual.ts', use: { ...devices['Pixel 7'], colorScheme: 'dark' } },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
