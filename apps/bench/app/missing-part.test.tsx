// @vitest-environment jsdom
/**
 * An older build may lack a part a case uses. Vite's shim makes that export
 * undefined, and React 19 reports the render error instead of throwing it, so
 * the page has to turn it into a failed run rather than measure an empty case.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, expect, it, vi } from 'vitest';
import '../../../packages/design-system/src/test/setup.ts';

vi.mock('@tounsoo/todae', async (original) => ({ ...(await original<object>()), Coachmark: undefined }));

class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeAll(async () => {
  Object.assign(window, { ResizeObserver: StubObserver, IntersectionObserver: StubObserver });
  new Function(await readFile(join(import.meta.dirname, 'probe.js'), 'utf8'))();
  await import('./main.tsx');
});

it('fails the run of a case whose part the build lacks, and still runs the others', async () => {
  // jsdom also reports the render error on window; keep it out of the test output.
  window.addEventListener('error', (event) => event.preventDefault());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const bench = window.__bench!;
  await bench.prepare('coachmark-closed', 3);
  await expect(bench.iterate()).rejects.toThrow(/Root/);
  await bench.prepare('tooltip', 3);
  const sample = await bench.iterate();
  expect(sample.nodes).toBeGreaterThan(0);
  expect(document.body.children.length).toBe(0);
});
