/**
 * The benchmark page. The runner opens it, calls `__bench.prepare()` for one
 * case and size, then `__bench.iterate()` once per run. Each run mounts the
 * case into a fresh root, updates it, does one interaction and unmounts it.
 *
 * Timed steps end with a forced style and layout read, so a time covers React
 * plus the browser's style and layout for that step, without waiting on the
 * next frame.
 */
import '@tounsoo/todae/todae.css';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { SCENARIOS, type Scenario } from './scenarios.tsx';

type Probe = {
  documentListeners: number;
  windowListeners: number;
  resizeObservers: number;
  mutationObservers: number;
  intersectionObservers: number;
  observersCreated: number;
  commits: number;
  rendered: number;
  nodes: number;
};

/** One run's numbers, keyed by metric name. */
export type Sample = Record<string, number>;

declare global {
  interface Window {
    __probe?: { snapshot(): Probe };
    /** Chrome's own counters (Performance.getMetrics), given by the runner. */
    __benchEngine?: () => Promise<Record<string, number>>;
    /** A full garbage collection, given by the runner. */
    __benchGc?: () => Promise<void>;
    __bench?: {
      list(): { id: string; title: string; copies?: readonly number[] }[];
      prepare(id: string, copies: number): Promise<void>;
      iterate(): Promise<Sample>;
    };
  }
}

const now = () => performance.now();
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
const microtasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
/** Forces style and layout now, so the time includes them. */
const layout = () => document.body.getBoundingClientRect().height;

function probe(): Probe {
  if (!window.__probe) throw new Error('the probe script did not load');
  return window.__probe.snapshot();
}

const live = (p: Probe) => p.resizeObservers + p.mutationObservers + p.intersectionObservers;

async function engine(): Promise<Record<string, number>> {
  return (await window.__benchEngine?.()) ?? {};
}

async function heap(): Promise<number | undefined> {
  await window.__benchGc?.();
  return (await engine()).JSHeapUsedSize;
}

let current: { scenario: Scenario; copies: number } | undefined;

async function iterate(): Promise<Sample> {
  if (!current) throw new Error('call prepare() first');
  const { scenario, copies } = current;
  const { Case } = scenario;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const sample: Sample = {};
  await frame();

  const heapBefore = await heap();
  const before = probe();
  const engineBefore = await engine();

  let start = now();
  flushSync(() => root.render(<Case copies={copies} tick={0} />));
  sample.mountMs = now() - start;
  layout();
  sample.mountWithLayoutMs = now() - start;

  const engineMounted = await engine();
  // Work a component defers to the next frame, such as a first measure, lands before the counts.
  await frame();
  await frame();
  const mounted = probe();
  sample.nodes = mounted.nodes - before.nodes;
  sample.documentListeners = mounted.documentListeners - before.documentListeners;
  sample.windowListeners = mounted.windowListeners - before.windowListeners;
  sample.resizeObservers = mounted.resizeObservers - before.resizeObservers;
  sample.mutationObservers = mounted.mutationObservers - before.mutationObservers;
  sample.intersectionObservers = mounted.intersectionObservers - before.intersectionObservers;
  sample.observersCreatedOnMount = mounted.observersCreated - before.observersCreated;
  sample.componentsRenderedOnMount = mounted.rendered - before.rendered;
  for (const name of ['RecalcStyleCount', 'LayoutCount', 'RecalcStyleDuration', 'LayoutDuration', 'ScriptDuration'] as const) {
    const a = engineBefore[name];
    const b = engineMounted[name];
    if (a !== undefined && b !== undefined) sample[`mount${name}`] = b - a;
  }
  const heapMounted = await heap();
  if (heapBefore !== undefined && heapMounted !== undefined) sample.heapKB = (heapMounted - heapBefore) / 1024;

  // Update: every instance gets a new label.
  const beforeUpdate = probe();
  start = now();
  flushSync(() => root.render(<Case copies={copies} tick={1} />));
  sample.updateMs = now() - start;
  layout();
  sample.updateWithLayoutMs = now() - start;
  await frame();
  const updated = probe();
  sample.componentsRenderedOnUpdate = updated.rendered - beforeUpdate.rendered;
  sample.observersCreatedOnUpdate = updated.observersCreated - beforeUpdate.observersCreated;

  if (scenario.interact) {
    const beforeAction = probe();
    start = now();
    scenario.interact(host);
    // React runs a discrete event's update in a microtask.
    await Promise.resolve();
    layout();
    sample.interactWithLayoutMs = now() - start;
    await frame();
    const acted = probe();
    sample.componentsRenderedOnInteract = acted.rendered - beforeAction.rendered;
  }

  start = now();
  flushSync(() => root.unmount());
  sample.unmountMs = now() - start;
  host.remove();
  await microtasks();
  await frame();
  const after = probe();
  // What stays attached after unmount.
  sample.leakedListeners = after.documentListeners + after.windowListeners - before.documentListeners - before.windowListeners;
  sample.leakedObservers = live(after) - live(before);
  return sample;
}

window.__bench = {
  list: () => SCENARIOS.map(({ id, title, copies }) => ({ id, title, copies })),
  async prepare(id, copies) {
    const scenario = SCENARIOS.find((entry) => entry.id === id);
    if (!scenario) throw new Error(`unknown case ${id}`);
    current = { scenario, copies };
    // Calendar and the date pickers need Temporal, which todae doesn't ship.
    if (!('Temporal' in globalThis)) await import('temporal-polyfill/global');
  },
  iterate,
};
