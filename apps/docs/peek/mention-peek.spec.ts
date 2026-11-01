import { expect, test, type Page } from '@playwright/test';

const PEEK = 'Design systems · Active now';

async function mentionPoint(page: Page) {
  const word = page.locator('[data-kind="@"]').filter({ hasText: '@Mina Park' }).first();
  const field = page.getByRole('textbox', { name: 'Message' });
  await field.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  const fromHighlight = await word.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height };
  }).catch(() => null);
  if (fromHighlight && fromHighlight.width > 0 && fromHighlight.height > 0) {
    return { x: fromHighlight.x, y: fromHighlight.y };
  }
  // Firefox hides the highlight layer, so the word's place is measured on the textarea.
  return field.evaluate((el) => {
    const node = el as HTMLTextAreaElement;
    const value = node.value;
    const at = value.indexOf('@Mina Park');
    const word = '@Mina Park';
    if (at < 0) throw new Error('no @Mina Park in the field');
    const style = getComputedStyle(node);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.font = style.font;
    const before = ctx.measureText(value.slice(0, at)).width;
    const mid = ctx.measureText(word).width / 2;
    const rect = node.getBoundingClientRect();
    const line = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2;
    return {
      x: rect.x + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft) + before + mid,
      y: rect.y + Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.paddingTop) + line / 2,
    };
  });
}

function touchProject() {
  const name = test.info().project.name;
  return name === 'iphone' || name === 'firefox-touch';
}

async function tap(page: Page, x: number, y: number) {
  if (touchProject()) await page.touchscreen.tap(x, y);
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

  const again = await mentionPoint(page);
  await tap(page, again.x, again.y);
  await expect(peek).toBeVisible();
});
