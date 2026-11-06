/**
 * Turns the page's raw samples into record metrics, with each one's kind and
 * unit. A metric the page reports but this table doesn't know is a mistake,
 * so it throws rather than guess how to compare it.
 */
import { metric, type CaseResult, type Metric, type MetricKind } from './record.ts';

type Spec = { kind: MetricKind; unit: string; scale?: number };

const time: Spec = { kind: 'time', unit: 'ms' };
const count: Spec = { kind: 'count', unit: 'count' };
// Chrome reports its durations in seconds.
const seconds: Spec = { kind: 'time', unit: 'ms', scale: 1000 };

export const METRICS: Record<string, Spec> = {
  mountMs: time,
  mountWithLayoutMs: time,
  updateMs: time,
  updateWithLayoutMs: time,
  interactWithLayoutMs: time,
  unmountMs: time,
  mountRecalcStyleDuration: seconds,
  mountLayoutDuration: seconds,
  mountScriptDuration: seconds,
  mountRecalcStyleCount: { kind: 'engine', unit: 'count' },
  mountLayoutCount: { kind: 'engine', unit: 'count' },
  heapKB: { kind: 'engine', unit: 'kB' },
  nodes: { kind: 'count', unit: 'nodes' },
  documentListeners: count,
  windowListeners: count,
  resizeObservers: count,
  mutationObservers: count,
  intersectionObservers: count,
  observersCreatedOnMount: count,
  observersCreatedOnUpdate: count,
  componentsRenderedOnMount: count,
  componentsRenderedOnUpdate: count,
  componentsRenderedOnInteract: count,
  nodesAddedOnInteract: count,
  observersCreatedOnInteract: count,
  leakedListeners: count,
  leakedObservers: count,
};

/** Builds one case result from the samples of its runs. */
export function toCase(id: string, title: string, samples: readonly Record<string, number>[]): CaseResult {
  const names = [...new Set(samples.flatMap((sample) => Object.keys(sample)))];
  const metrics: Record<string, Metric> = {};
  for (const name of names) {
    const spec = METRICS[name];
    if (!spec) throw new Error(`the page reported ${name}, which metrics.ts doesn't describe`);
    const values = samples.map((sample) => sample[name]).filter((value): value is number => value !== undefined);
    if (values.length === 0) continue;
    metrics[name] = metric(spec.kind, spec.unit, values.map((value) => value * (spec.scale ?? 1)));
  }
  return { id, title, metrics };
}
