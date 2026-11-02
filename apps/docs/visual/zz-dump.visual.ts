// TEMPORARY: prints the use-controlled-state example shot so its baseline can be taken from CI's log.
import { settle, test } from './setup.ts';

test('dump use-controlled-state example', async ({ page }, info) => {
  await page.goto('/utilities/use-controlled-state');
  await settle(page);
  const png = await page.locator('.example').nth(0).screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
  const text = png.toString('base64');
  for (let i = 0; i * 4000 < text.length; i++) {
    console.log(`DUMP ${info.project.name} ${String(i).padStart(4, '0')} ${text.slice(i * 4000, (i + 1) * 4000)}`);
  }
  console.log(`DUMP ${info.project.name} END ${png.length}`);
});
