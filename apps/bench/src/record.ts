/**
 * The shape of one benchmark record, the JSON file each run writes, and the
 * statistics every metric carries.
 */

/**
 * How far a metric can be compared between records.
 * - `count`: exact counts that don't depend on the machine (DOM nodes, live
 *   listeners and observers, bundle bytes). They compare against any record.
 * - `engine`: counts the browser itself reports, such as style recalcs,
 *   layouts and heap size. They compare when the browser's major version is
 *   the same.
 * - `time`: milliseconds. They compare only between runs on the same machine
 *   type.
 */
export type MetricKind = 'count' | 'engine' | 'time';

export type Stats = {
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  n: number;
};

export type Metric = Stats & { kind: MetricKind; unit: string };

export type CaseResult = {
  /** Stable id, such as `menu-closed/100` or `bundle/Field`. */
  id: string;
  title: string;
  metrics: Record<string, Metric>;
  /** Set when the case couldn't run, for example on an older ref without that component. */
  error?: string;
};

export type Machine = {
  /** Timings compare only between records with the same type. */
  type: string;
  os: string;
  arch: string;
  cpu: string;
  cpus: number;
  memoryGB: number;
  ci: boolean;
};

export type BenchRecord = {
  schema: 1;
  /** File name without `.json`. */
  name: string;
  date: string;
  todae: { version: string; sha: string; ref: string; dirty: boolean };
  /** The commit the bench code itself ran from. */
  bench: { sha: string };
  machine: Machine;
  browser: { name: string; version: string };
  node: string;
  settings: { runs: number; warmups: number; sizes: number[] };
  cases: CaseResult[];
};

/** Quantile by linear interpolation, on a sorted copy. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  const low = sorted[lo] as number;
  const high = sorted[hi] as number;
  return low + (high - low) * (at - lo);
}

const round = (value: number) => Math.round(value * 1000) / 1000;

export function stats(samples: readonly number[]): Stats {
  const sorted = samples.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) throw new Error('stats() needs at least one finite sample');
  return {
    median: round(quantile(sorted, 0.5)),
    p25: round(quantile(sorted, 0.25)),
    p75: round(quantile(sorted, 0.75)),
    min: round(sorted[0] as number),
    max: round(sorted[sorted.length - 1] as number),
    n: sorted.length,
  };
}

export function metric(kind: MetricKind, unit: string, samples: readonly number[]): Metric {
  return { kind, unit, ...stats(samples) };
}

/** Turns a ref or label into a safe file-name part. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** The default record name: date, then the version or ref, then the short SHA. */
export function recordName(record: Pick<BenchRecord, 'date' | 'todae'>, label?: string): string {
  const day = record.date.slice(0, 10);
  const short = record.todae.sha.slice(0, 7);
  return [day, slug(label ?? record.todae.ref), short].filter(Boolean).join('-');
}

/** Throws with a readable message when a parsed file is not a record this code can read. */
export function assertRecord(value: unknown, source: string): asserts value is BenchRecord {
  const record = value as Partial<BenchRecord> | null;
  if (!record || typeof record !== 'object') throw new Error(`${source}: not a JSON object`);
  if (record.schema !== 1) throw new Error(`${source}: unknown record schema ${String(record.schema)}`);
  for (const key of ['name', 'date', 'todae', 'machine', 'browser', 'cases'] as const) {
    if (record[key] === undefined) throw new Error(`${source}: the record has no ${key}`);
  }
  if (!Array.isArray(record.cases)) throw new Error(`${source}: cases is not a list`);
}
