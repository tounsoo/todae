import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

// Behaviour only. Screenshot baselines stay in playwright.config.ts.
export default defineConfig({
  testDir: 'peek',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
    { name: 'chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-touch', use: { ...devices['Desktop Firefox'], hasTouch: true } },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
