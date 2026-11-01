import { INDEX_GROUPS } from '../components/siteGroups.ts';
import { AXE_OPTIONS, describeViolations } from '../test/axe.ts';
import { expect, settle, test } from './setup.ts';

// Home, Button and the playground show their own first screen. A catalog's first
// screen includes the first items' summaries, so those intros are part of its baseline.
const PAGES = ['', 'button', 'playground', ...INDEX_GROUPS];

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
