import { expect, test, type Page } from '@playwright/test';

const PEEK = 'Design systems · Active now';

async function mentionPoint(page: Page) {
  const word = page.locator('[data-kind="@"]').filter({ hasText: '@Mina Park' }).first();
  await word.scrollIntoViewIfNeeded();
  const box = await word.boundingBox();
  if (!box) throw new Error('no on-screen box for @Mina Park');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function tap(page: Page, x: number, y: number) {
  if (test.info().project.name === 'iphone') await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test('an outside tap closes the mention peek', async ({ page }) => {
  await page.goto('/mention');
  const point = await mentionPoint(page);
  const peek = page.locator('[popover]:popover-open').filter({ hasText: PEEK });
  await tap(page, point.x, point.y);
  await expect(peek).toBeVisible();

  const blank = await page.evaluate(() => {
    const field = document.querySelector('textarea');
    const width = window.innerWidth;
    const height = window.innerHeight;
    const candidates = [
      { x: 8, y: 8 },
      { x: width - 8, y: 80 },
      { x: width / 2, y: 8 },
      { x: 24, y: height - 24 },
    ];
    for (const point of candidates) {
      const hit = document.elementFromPoint(point.x, point.y);
      if (!hit) continue;
      if (field && (hit === field || field.contains(hit))) continue;
      if (hit.closest('[popover]')) continue;
      return point;
    }
    throw new Error('no blank point');
  });
  await tap(page, blank.x, blank.y);
  await expect(peek).toHaveCount(0);
});
