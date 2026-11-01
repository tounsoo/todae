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

const ANIMATION_FRAME_MS = 16;

type PwClock = { now(): number; pauseAt(time: number): Promise<unknown> };

// Playwright 1.56 leaves its real-time ticker running through `page.clock.runFor`. After a
// minute of timers the ticker can put `ticks` back near wall time, while an animation frame
// scheduled at the forwarded time is still about a minute ahead. The test then times out
// waiting for that frame. The pause runs in the page so the read and the pause are one turn.
// `page.clock.pauseAt` from the test reads the time first, and that time is already past.
async function pauseClock(page: Page) {
  await page.evaluate(() => {
    const clock = (globalThis as { __pwClock?: { controller: PwClock } }).__pwClock?.controller;
    if (!clock) throw new Error('Playwright clock is not installed');
    return clock.pauseAt(clock.now());
  });
}

async function frames(page: Page) {
  const pending = await page.evaluateHandle(() => {
    let finish = () => {};
    const done = new Promise<void>((resolve) => {
      finish = resolve;
    });
    requestAnimationFrame(() => requestAnimationFrame(() => finish()));
    return { done };
  });
  try {
    // The first frame is at most one boundary away, and the second is scheduled from that boundary.
    await page.clock.runFor(ANIMATION_FRAME_MS * 2);
    await pending.evaluate(async (box: { done: Promise<void> }) => {
      await box.done;
    });
  } finally {
    await pending.dispose();
  }
}

/**
 * Waits for the page to hydrate, then runs its timers a minute at a time until the page stops
 * changing, so a demo that plays out on a timer, such as Attachment's upload or Steps' plan, is
 * shot in its end state.
 */
export async function settle(page: Page) {
  // Demos start their timers in effects, which run only once React has hydrated the page.
  await page.waitForFunction(() => Object.keys(document.body).some((key) => key.startsWith('__reactFiber')));
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  try {
    await pauseClock(page);
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
  } catch (error) {
    await page.clock.resume().catch(() => undefined);
    throw error;
  }
  await page.clock.resume();
}
