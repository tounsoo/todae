import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, settle, test } from './setup.ts';

const PAGES = join(__dirname, '../app/(en)');

// Every English page with an example, built. Each must hydrate and stop changing once its demo
// timers run out, so a demo that never settles fails here.
const slugs = readdirSync(PAGES, { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('page.mdx') && readFileSync(join(PAGES, file), 'utf8').includes('<Example'))
  .map((file) => file.replace(/\/?page\.mdx$/, ''))
  .sort();

test('found the pages with examples', () => {
  expect(slugs.length).toBeGreaterThan(40);
});

for (const slug of slugs) {
  test(slug, async ({ page }) => {
    await page.goto(`/${slug}`);
    await settle(page);
    await expect(page.locator('.example').first()).toBeVisible();
  });
}
