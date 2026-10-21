import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, settle, test } from './setup.ts';

const PAGES = join(__dirname, '../app/(en)');

// Every English page with an example. Korean pages render the same demos in English.
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
    const examples = page.locator('.example');
    // Each shot is named after the heading above it, so adding an example moves only its section's names.
    const names = await examples.evaluateAll((nodes) => {
      const seen = new Map<string, number>();
      return nodes.map((node) => {
        const headings = [...document.querySelectorAll('main h2, main h3')].filter(
          (h) => h.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
        );
        const heading = headings.at(-1)?.textContent ?? 'top';
        const base = heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'top';
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        return n === 1 ? base : `${base}-${n}`;
      });
    });
    expect(names.length).toBeGreaterThan(0);
    for (const [i, name] of names.entries()) {
      await expect.soft(examples.nth(i)).toHaveScreenshot([...slug.split('/'), `${name}.png`]);
    }
  });
}
