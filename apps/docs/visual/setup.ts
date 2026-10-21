import { test as base } from '@playwright/test';

// Calendar and time demos read the clock, so every page sees the same moment.
export const test = base.extend({
  page: async ({ page }, run) => {
    await page.clock.setFixedTime(new Date('2026-03-12T09:30:00Z'));
    await run(page);
  },
});

export { expect } from '@playwright/test';

/** Waits for fonts and two frames, so layout that measures itself has settled. */
export async function settle(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
