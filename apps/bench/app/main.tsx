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
import { isResizeLoop } from './resizeLoop.ts';
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
/**
 * React runs a discrete event's update in a microtask, and work its commit
 * queues, such as a measure that waits for a popover to show, runs in the
 * microtasks after that. A few hops let both in before a forced layout,
 * without letting a frame in.
 */
const afterCommit = async () => {
  for (let hop = 0; hop < 3; hop += 1) await Promise.resolve();
};
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
  const host = document.createElement('div');
  document.body.append(host);
  // React 19 reports a render error instead of throwing it from flushSync, and
  // an event handler's error only reaches window. Either fails the run, so a
  // case whose part is missing or broken is reported as failed, not measured.
  // Chromium's resize loop report reaches window too, but nothing threw: it is
  // counted, so a part whose resize callback resizes what it observes shows.
  let failure: unknown;
  let resizeLoops = 0;
  const fail = (error: unknown) => {
    failure ??= error;
  };
  const onError = (event: ErrorEvent) => {
    if (isResizeLoop(event.message)) resizeLoops += 1;
    else fail(event.error ?? event.message);
  };
  window.addEventListener('error', onError);
  const check = () => {
    if (failure !== undefined) throw failure instanceof Error ? failure : new Error(String(failure));
  };
  const root = createRoot(host, { onUncaughtError: fail });
  try {
    const sample = await measure(scenario, copies, host, root, check);
    sample.resizeObserverLoops = resizeLoops;
    return sample;
  } finally {
    window.removeEventListener('error', onError);
    if (host.isConnected) {
      try {
        flushSync(() => root.unmount());
      } catch {
        // The run already failed; the next one starts from a fresh root.
      }
      host.remove();
    }
  }
}

async function measure(
  scenario: Scenario,
  copies: number,
  host: HTMLElement,
  root: ReturnType<typeof createRoot>,
  check: () => void,
): Promise<Sample> {
  const { Case } = scenario;
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
  check();

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
  check();
  await frame();
  const updated = probe();
  sample.componentsRenderedOnUpdate = updated.rendered - beforeUpdate.rendered;
  sample.observersCreatedOnUpdate = updated.observersCreated - beforeUpdate.observersCreated;

  if (scenario.interact) {
    const beforeAction = probe();
    start = now();
    scenario.interact(host);
    await afterCommit();
    layout();
    sample.interactWithLayoutMs = now() - start;
    await frame();
    check();
    const acted = probe();
    sample.componentsRenderedOnInteract = acted.rendered - beforeAction.rendered;
    // Work a part defers from mount to its first open shows here, not in the mount counts.
    sample.nodesAddedOnInteract = acted.nodes - beforeAction.nodes;
    sample.observersCreatedOnInteract = acted.observersCreated - beforeAction.observersCreated;
  }

  start = now();
  flushSync(() => root.unmount());
  sample.unmountMs = now() - start;
  host.remove();
  await microtasks();
  await frame();
  check();
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
