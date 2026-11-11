import { AXE_OPTIONS, describeViolations } from '../test/axe.ts';
import { expect, settle, test } from './setup.ts';

// The site's own chrome in Korean: the home page, a component page and the playground, built.
// site.browser.test.tsx runs axe over the English chrome.
const PAGES = ['', 'button', 'playground'];

for (const slug of PAGES) {
  test(`ko /${slug}`, async ({ page }) => {
    await page.goto(`/${['ko', slug].filter(Boolean).join('/')}`);
    await settle(page);
    await page.addScriptTag({ path: require.resolve('axe-core') });
    const result = await page.evaluate((options) => window.axe.run(document, options), AXE_OPTIONS);
    expect(describeViolations(result)).toEqual([]);
  });
}

declare global {
  interface Window {
    axe: typeof import('axe-core');
  }
}
