// @vitest-environment jsdom
/**
 * A smoke run of the benchmark page in jsdom: every case mounts, updates,
 * takes its interaction and unmounts without throwing, and every number the
 * page reports is one the record knows how to compare. jsdom has no layout
 * and no Chrome counters, so this checks the page's code, not its numbers.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { METRICS } from '../src/metrics.ts';
// todae's own jsdom stand-ins for the popover API, dialogs, matchMedia and Temporal.
import '../../../packages/design-system/src/test/setup.ts';

class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeAll(async () => {
  // jsdom lacks these. The probe wraps whatever is there when it loads.
  Object.assign(window, { ResizeObserver: StubObserver, IntersectionObserver: StubObserver });
  // The probe must load before React, as Playwright's init script does.
  new Function(await readFile(join(import.meta.dirname, 'probe.js'), 'utf8'))();
  await import('./main.tsx');
});

describe('the benchmark page', () => {
  it('runs every case and reports only known metrics', { timeout: 300_000 }, async () => {
    const bench = window.__bench!;
    const cases = bench.list();
    expect(cases.map((entry) => entry.id)).toContain('billing-page');
    for (const entry of cases) {
      await bench.prepare(entry.id, entry.copies?.[0] ?? 3);
      // The first run may start a page-wide singleton, such as a shared observer, that stays by design.
      await bench.iterate();
      const sample = await bench.iterate();
      for (const name of Object.keys(sample)) expect(METRICS, `${entry.id} reported ${name}`).toHaveProperty(name);
      expect(sample.nodes, entry.id).toBeGreaterThan(0);
      expect(sample.leakedObservers, entry.id).toBe(0);
    }
  });

  it("takes each hook case's interaction through the hook", async () => {
    const bench = window.__bench!;
    // A case whose interaction misses its hook would time nothing but the event.
    for (const id of ['use-combobox', 'use-roving-focus', 'use-inline-edit']) {
      await bench.prepare(id, 3);
      const sample = await bench.iterate();
      expect(sample.componentsRenderedOnInteract, id).toBeGreaterThan(0);
    }
  });

  it("moves focus with the roving focus case's arrow key", async () => {
    // Focusing the first item alone renders too, so check where the arrow key left focus.
    // Imported here, since React must load after the probe.
    const { flushSync } = await import('react-dom');
    const { createRoot } = await import('react-dom/client');
    const { SCENARIOS } = await import('./scenarios.tsx');
    const scenario = SCENARIOS.find((entry) => entry.id === 'use-roving-focus')!;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    flushSync(() => root.render(<scenario.Case copies={2} tick={0} />));
    flushSync(() => scenario.interact!(host));
    expect(document.activeElement?.textContent).toBe('Italic');
    flushSync(() => root.unmount());
    host.remove();
  });

  it("counts Chromium's resize loop report instead of failing the run", async () => {
    const bench = window.__bench!;
    await bench.prepare('menu-closed', 3);
    const run = bench.iterate();
    // Chromium dispatches it on window, with no error object, during a frame of the run.
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }));
    const sample = await run;
    expect(sample.resizeObserverLoops).toBe(1);
    expect(sample.nodes).toBeGreaterThan(0);
    expect((await bench.iterate()).resizeObserverLoops).toBe(0);
  });

  it('counts listeners and observers that a case leaves attached', async () => {
    const probe = window.__probe!;
    const before = probe.snapshot();
    const listener = () => {};
    document.addEventListener('keydown', listener);
    document.addEventListener('keydown', listener);
    window.addEventListener('resize', listener, { once: true });
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { childList: true });
    const during = probe.snapshot();
    expect(during.documentListeners - before.documentListeners).toBe(1);
    expect(during.windowListeners - before.windowListeners).toBe(0);
    expect(during.mutationObservers - before.mutationObservers).toBe(1);
    expect(during.observersCreated - before.observersCreated).toBe(1);
    document.removeEventListener('keydown', listener);
    observer.disconnect();
    const after = probe.snapshot();
    expect(after.documentListeners).toBe(before.documentListeners);
    expect(after.mutationObservers).toBe(before.mutationObservers);
  });
});
