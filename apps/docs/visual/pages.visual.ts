import { AXE_OPTIONS, describeViolations } from '../test/axe.ts';
import { expect, settle, test } from './setup.ts';

// The site's own chrome in both languages: the home page, a component page, the playground
// and the three catalog pages. Only the first screen is shot, so editing a page's prose
// below it doesn't change the baseline.
const PAGES = ['', 'button', 'playground', 'components', 'utilities', 'recipes'];

for (const locale of ['en', 'ko']) {
  for (const slug of PAGES) {
    const path = [locale === 'en' ? '' : locale, slug].filter(Boolean).join('/');
    test(`${locale} /${slug}`, async ({ page }) => {
      await page.goto(`/${path}`);
      await settle(page);
      await expect.soft(page).toHaveScreenshot([locale, `${slug || 'home'}.png`]);
      // site.browser.test.tsx runs axe over the English chrome; this covers the Korean pages.
      if (locale === 'en') return;
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
