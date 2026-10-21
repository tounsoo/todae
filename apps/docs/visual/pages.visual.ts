import { AXE_OPTIONS, describeViolations } from '../test/axe.ts';
import { expect, settle, test } from './setup.ts';

// The site's own chrome in both languages: the home page, a component page and the playground.
// Only the first screen is shot, so editing a page's prose below it doesn't change the baseline.
const PAGES = ['', 'button', 'playground'];

for (const locale of ['en', 'ko']) {
  for (const slug of PAGES) {
    const path = [locale === 'en' ? '' : locale, slug].filter(Boolean).join('/');
    test(`${locale} /${slug}`, async ({ page }, testInfo) => {
      await page.goto(`/${path}`);
      await settle(page);
      await expect.soft(page).toHaveScreenshot([locale, `${slug || 'home'}.png`]);
      // site.browser.test.tsx runs axe over the English chrome. This covers the Korean pages, at
      // desktop and phone width; axe without its contrast rule finds the same in dark.
      if (locale === 'en' || testInfo.project.name.endsWith('dark')) return;
      await page.addScriptTag({ path: require.resolve('axe-core') });
      const result = await page.evaluate((options) => window.axe.run(document, options), AXE_OPTIONS);
      expect(describeViolations(result)).toEqual([]);
    });
  }
}

declare global {
  interface Window {
    axe: typeof import('axe-core');
  }
}
