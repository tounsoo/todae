/**
 * Compares two benchmark records.
 *
 * Exact counts compare against any record. Engine counts compare when both
 * runs used the same browser major version. Timings compare only when both
 * runs came from the same machine type; otherwise they're left out with a
 * warning, because a faster machine is not a faster todae.
 */
import type { BenchRecord, Metric } from './record.ts';

export type Verdict =
  | 'same'
  | 'more'
  | 'fewer'
  | 'faster'
  | 'slower'
  | 'noise'
  | 'added'
  | 'removed'
  | 'failed';

export type Row = {
  caseId: string;
  metric: string;
  unit: string;
  kind: Metric['kind'];
  before?: Metric;
  after?: Metric;
  verdict: Verdict;
  /** after − before, on the medians. */
  delta?: number;
  /** delta as a share of before, when before isn't 0. */
  ratio?: number;
  note?: string;
};

export type Comparison = {
  before: BenchRecord;
  after: BenchRecord;
  warnings: string[];
  rows: Row[];
  timings: boolean;
  engine: boolean;
};

/** A timing change smaller than this share of the old median is never called real. */
export const TIMING_FLOOR = 0.05;

const major = (version: string) => version.split('.')[0] ?? version;

/** Fewer runs than this give no verdict on a timing or browser count. */
export const MIN_RUNS = 3;

/**
 * A timing or browser count changed only when every run of one side beats
 * every run of the other and the medians differ by TIMING_FLOOR or more. For
 * two sides of the same code, five runs each split cleanly by chance about
 * once in 125 metrics (2 of the 252 ways to order ten runs), and ten runs each
 * about once in 90,000.
 */
function spreadVerdict(before: Metric, after: Metric, lower: Verdict, higher: Verdict): Verdict {
  if (before.n < MIN_RUNS || after.n < MIN_RUNS) return 'noise';
  const apart = after.max < before.min || before.max < after.min;
  const base = Math.abs(before.median) || 1;
  const small = Math.abs(after.median - before.median) / base < TIMING_FLOOR;
  if (!apart || small) return 'noise';
  return after.median < before.median ? lower : higher;
}

function judge(before: Metric, after: Metric): Verdict {
  if (before.kind === 'count') {
    if (after.median === before.median) return 'same';
    return after.median > before.median ? 'more' : 'fewer';
  }
  if (before.kind === 'time') return spreadVerdict(before, after, 'faster', 'slower');
  return spreadVerdict(before, after, 'fewer', 'more');
}

export function compare(before: BenchRecord, after: BenchRecord): Comparison {
  const warnings: string[] = [];
  const timings = before.machine.type === after.machine.type;
  if (!timings) {
    warnings.push(
      `Timings left out: the records come from different machine types (${before.machine.type} and ${after.machine.type}). Only counts are compared. Run both on one machine, or use --against, for timings.`,
    );
  }
  const engine = before.browser.name === after.browser.name && major(before.browser.version) === major(after.browser.version);
  if (!engine) {
    warnings.push(
      `Browser counts left out: the records come from different browsers (${before.browser.name} ${before.browser.version} and ${after.browser.name} ${after.browser.version}).`,
    );
  }
  if (before.settings.runs !== after.settings.runs) {
    warnings.push(`The records took a different number of runs per case (${before.settings.runs} and ${after.settings.runs}).`);
  }

  const rows: Row[] = [];
  const beforeCases = new Map(before.cases.map((entry) => [entry.id, entry]));
  const afterCases = new Map(after.cases.map((entry) => [entry.id, entry]));
  const ids = [...new Set([...beforeCases.keys(), ...afterCases.keys()])];

  for (const id of ids) {
    const old = beforeCases.get(id);
    const next = afterCases.get(id);
    if (old?.error || next?.error) {
      rows.push({
        caseId: id,
        metric: '',
        unit: '',
        kind: 'count',
        verdict: 'failed',
        note: [old?.error && `before: ${old.error}`, next?.error && `after: ${next.error}`].filter(Boolean).join('; '),
      });
      continue;
    }
    if (!old || !next) {
      rows.push({ caseId: id, metric: '', unit: '', kind: 'count', verdict: old ? 'removed' : 'added' });
      continue;
    }
    const names = [...new Set([...Object.keys(old.metrics), ...Object.keys(next.metrics)])];
    for (const name of names) {
      const a = old.metrics[name];
      const b = next.metrics[name];
      const kind = (a ?? b)!.kind;
      const unit = (a ?? b)!.unit;
      if ((kind === 'time' && !timings) || (kind === 'engine' && !engine)) continue;
      if (!a || !b) {
        rows.push({ caseId: id, metric: name, unit, kind, before: a, after: b, verdict: a ? 'removed' : 'added' });
        continue;
      }
      const delta = b.median - a.median;
      rows.push({
        caseId: id,
        metric: name,
        unit,
        kind,
        before: a,
        after: b,
        verdict: judge(a, b),
        delta,
        ratio: a.median === 0 ? undefined : delta / a.median,
      });
    }
  }
  return { before, after, warnings, rows, timings, engine };
}

/** True when a row is worth showing without --all. */
export function changed(row: Row): boolean {
  return row.verdict !== 'same' && row.verdict !== 'noise';
}

const number = (value: number, unit: string) => {
  if (unit === 'bytes') return Math.abs(value) < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} kB`;
  if (unit === 'ms') return `${value.toFixed(value < 10 ? 2 : 1)} ms`;
  if (unit === 'kB') return `${value.toFixed(0)} kB`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

function cell(value: Metric | undefined, unit: string): string {
  if (!value) return '–';
  const main = number(value.median, unit);
  return value.kind === 'count' ? main : `${main} (${number(value.min, unit)}–${number(value.max, unit)})`;
}

function change(row: Row): string {
  if (row.delta === undefined) return row.verdict;
  const sign = row.delta > 0 ? '+' : '';
  const share = row.ratio === undefined ? '' : ` (${sign}${(row.ratio * 100).toFixed(0)}%)`;
  return `${row.verdict}: ${sign}${number(row.delta, row.unit)}${share}`;
}

const tableText = (text: string) => text.replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ');

/** A Markdown report, readable in a terminal and in a GitHub job summary. */
export function format(comparison: Comparison, options: { all?: boolean; title?: string } = {}): string {
  const { before, after } = comparison;
  const label = (record: BenchRecord) => `${record.todae.ref} (${record.todae.version}, ${record.todae.sha.slice(0, 7)})`;
  const lines = [`## ${options.title ?? 'Benchmark comparison'}`, '', `Before: ${label(before)} · After: ${label(after)}`, ''];
  for (const warning of comparison.warnings) lines.push(`> ${warning}`, '');

  const shown = options.all ? comparison.rows : comparison.rows.filter(changed);
  const quiet = comparison.rows.length - shown.length;
  if (shown.length === 0) {
    lines.push('No metric changed.');
  } else {
    lines.push('| Case | Metric | Before | After | Change |', '|---|---|---|---|---|');
    for (const row of shown) {
      if (row.verdict === 'failed') {
        lines.push(`| ${row.caseId} | | | | failed: ${tableText(row.note ?? '')} |`);
        continue;
      }
      if (!row.metric) {
        lines.push(`| ${row.caseId} | | | | ${row.verdict} case |`);
        continue;
      }
      lines.push(`| ${row.caseId} | ${row.metric} | ${cell(row.before, row.unit)} | ${cell(row.after, row.unit)} | ${change(row)} |`);
    }
  }
  if (quiet > 0) {
    lines.push('', `${quiet} other metrics were the same or within noise. Add --all to list them.`);
  }
  lines.push(
    '',
    'Timings and browser counts show the median with the fastest and slowest run in brackets. A change counts only when those ranges don\'t overlap and the medians differ by 5% or more.',
  );
  return lines.join('\n');
}
