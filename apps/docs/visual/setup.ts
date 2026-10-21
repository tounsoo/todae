import { test as base, type Page } from '@playwright/test';

const START = new Date('2026-03-12T09:30:00Z');

// Every page starts at the same moment on a fake clock, so Calendar and time demos read the same
// day, and `settle` can run demo timers to their end.
export const test = base.extend({
  page: async ({ page }, run) => {
    await page.clock.install({ time: START });
    await run(page);
  },
});

export { expect } from '@playwright/test';

const frames = (page: Page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

/**
 * Waits for the page to hydrate, then runs its timers a minute at a time until the page stops
 * changing, so a demo that plays out on a timer, such as Attachment's upload or Steps' plan, is
 * shot in its end state.
 */
export async function settle(page: Page) {
  // Demos start their timers in effects, which run only once React has hydrated the page.
  await page.waitForFunction(() => Object.keys(document.body).some((key) => key.startsWith('__reactFiber')));
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await frames(page);
  // A demo that sets its next timer after React renders, as Steps does, advances one step a round.
  let before = '';
  for (let round = 0; ; round++) {
    const html = await page.evaluate(() => document.body.innerHTML);
    if (html === before) break;
    // A demo that never stops, such as a live clock, would be shot at whatever moment the run reached.
    if (round === 20) throw new Error(`${page.url()} still changes after 20 minutes of timers`);
    before = html;
    await page.clock.runFor(60_000);
    await frames(page);
  }
}
