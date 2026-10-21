import { expect, settle, test } from './setup.ts';

// The site's own chrome in both languages: the home page, a component page and the playground.
// Only the first screen is shot, so editing a page's prose below it doesn't change the baseline.
const PAGES = ['', 'button', 'playground'];

for (const locale of ['en', 'ko']) {
  for (const slug of PAGES) {
    const path = [locale === 'en' ? '' : locale, slug].filter(Boolean).join('/');
    test(`${locale} /${slug}`, async ({ page }) => {
      await page.goto(`/${path}`);
      await settle(page);
      await expect(page).toHaveScreenshot([locale, `${slug || 'home'}.png`]);
      // The demo tests run axe on the examples alone; this covers the shell around them in each
      // language and at phone width. Color contrast is off, since Todae checks it with APCA.
      await page.addScriptTag({ path: require.resolve('axe-core') });
      const violations = await page.evaluate(async () => {
        const result = await window.axe.run(document, { rules: { 'color-contrast': { enabled: false } } });
        return result.violations.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`);
      });
      expect(violations).toEqual([]);
    });
  }
}

declare global {
  interface Window {
    axe: typeof import('axe-core');
  }
}
