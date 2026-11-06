// @vitest-environment jsdom
/**
 * `--against` runs every case on an older build too, where a newer export is
 * undefined. A case that calls a todae export while its module loads would
 * break the whole page on such a build, not just its own case, so this loads
 * the page with every export gone except two the docs' billing demo reads at load.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, expect, it, vi } from 'vitest';
import '../../../packages/design-system/src/test/setup.ts';

vi.mock('@tounsoo/todae', async (original) => {
  const real = await original<Record<string, unknown>>();
  return Object.fromEntries(
    Object.keys(real).map((name) => [name, name === 'Code' || name === 'Kbd' ? real[name] : undefined]),
  );
});

beforeAll(async () => {
  new Function(await readFile(join(import.meta.dirname, 'probe.js'), 'utf8'))();
  await import('./main.tsx');
});

it('loads the page and lists every case when the build lacks every part', () => {
  expect(window.__bench!.list().length).toBeGreaterThan(100);
});
