import { defineConfig, devices, webkit } from '@playwright/test';
import { firefoxOnHost, webkitOnHost } from '../../playwright.host';

const PORT = 3100;

// Behaviour only. axe over the Korean pages is in playwright.config.ts.
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
    // On macOS, playwright.host.ts gives WebKit Linux's Tab order and Firefox a home it can start from.
    { name: 'iphone', use: { ...devices['iPhone 13'], launchOptions: webkitOnHost(webkit.executablePath()) } },
    { name: 'chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-touch', use: { ...devices['Desktop Firefox'], hasTouch: true, launchOptions: firefoxOnHost() } },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
