import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

// axe over the built docs site's Korean pages, in light and dark, at desktop and phone width, and
// a smoke run over every English page with an example, in light at desktop width.
export default defineConfig({
  testDir: 'axe',
  testMatch: '*.axe.ts',
  fullyParallel: true,
  // The docs CI runner has 4 cores. Playwright's default is half of them.
  workers: process.env.CI ? 4 : undefined,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    timezoneId: 'UTC',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'light', testMatch: ['*.axe.ts', '*.smoke.ts'], use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    { name: 'phone-light', use: { ...devices['Pixel 7'], colorScheme: 'light' } },
    { name: 'phone-dark', use: { ...devices['Pixel 7'], colorScheme: 'dark' } },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    port: PORT,
    // Always this build's server: one left running from an older build would check stale pages.
    reuseExistingServer: false,
  },
});
