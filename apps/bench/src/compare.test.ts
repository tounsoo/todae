import { describe, expect, it } from 'vitest';
import { changed, compare, format } from './compare.ts';
import { describeMachine } from './machine.ts';
import { metric, recordName, slug, stats, type BenchRecord, type Metric } from './record.ts';
import { selectJobs } from './run.ts';

function record(overrides: Partial<BenchRecord> & { metrics?: Record<string, Metric> } = {}): BenchRecord {
  const { metrics, ...rest } = overrides;
  return {
    schema: 1,
    name: 'r',
    date: '2026-11-06T00:00:00.000Z',
    todae: { version: '0.7.0', sha: 'a'.repeat(40), ref: 'main', dirty: false },
    bench: { sha: 'b'.repeat(40) },
    machine: { type: 'github-ubuntu24 x64 4cpu AMD EPYC 7763', os: 'linux', arch: 'x64', cpu: 'AMD EPYC 7763', cpus: 4, memoryGB: 16, ci: true },
    browser: { name: 'chromium', version: '141.0.7390.37' },
    node: 'v24.0.0',
    settings: { runs: 5, warmups: 1, sizes: [10, 100, 1000] },
    cases: [{ id: 'menu-closed/100', title: 'Menu', metrics: metrics ?? {} }],
    ...rest,
  };
}

const time = (...samples: number[]) => metric('time', 'ms', samples);
const count = (value: number) => metric('count', 'count', [value]);

describe('stats', () => {
  it('gives the median and the middle half', () => {
    expect(stats([5, 1, 3, 2, 4])).toEqual({ median: 3, p25: 2, p75: 4, min: 1, max: 5, n: 5 });
    expect(stats([1, 2, 3, 4])).toMatchObject({ median: 2.5, p25: 1.75, p75: 3.25 });
  });

  it('refuses an empty sample', () => {
    expect(() => stats([])).toThrow();
  });
});

describe('compare', () => {
  it('compares counts across machine types and leaves timings out with a warning', () => {
    const before = record({ metrics: { nodes: count(1400), mountMs: time(100, 101, 102) } });
    const after = record({
      machine: { ...before.machine, type: 'darwin arm64 10cpu Apple M1 Pro' },
      metrics: { nodes: count(1200), mountMs: time(10, 11, 12) },
    });
    const result = compare(before, after);
    expect(result.timings).toBe(false);
    expect(result.warnings.join(' ')).toMatch(/different machine types/);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ metric: 'nodes', verdict: 'fewer', delta: -200 });
  });

  it('calls a timing change only when no run of one side overlaps the other', () => {
    const before = record({ metrics: { mountMs: time(100, 102, 104, 106, 108) } });
    // The middle halves don't overlap, but the slowest before run is slower than the fastest after run.
    const overlapping = record({ metrics: { mountMs: time(107, 120, 121, 122, 123) } });
    const faster = record({ metrics: { mountMs: time(50, 51, 52, 53, 54) } });
    expect(compare(before, overlapping).rows[0]?.verdict).toBe('noise');
    expect(compare(before, faster).rows[0]?.verdict).toBe('faster');
    expect(compare(faster, before).rows[0]?.verdict).toBe('slower');
  });

  it('gives no timing verdict on fewer than five runs, and says so', () => {
    const settings = { runs: 3, warmups: 1, sizes: [10] };
    const before = record({ settings, metrics: { mountMs: time(100, 100, 100) } });
    const after = record({ settings, metrics: { mountMs: time(50, 50, 50) } });
    const result = compare(before, after);
    expect(result.rows[0]?.verdict).toBe('noise');
    expect(result.warnings.join(' ')).toMatch(/needs 5/);
  });

  it('gives the same verdict whichever record comes first', () => {
    const a = record({ metrics: { mountMs: time(99, 99.5, 100, 100.5, 101) } });
    const b = record({ metrics: { mountMs: time(93, 94, 95.2, 96, 97) } });
    expect(compare(a, b).rows[0]?.verdict).toBe('noise');
    expect(compare(b, a).rows[0]?.verdict).toBe('noise');
  });

  it('treats a tiny timing shift as noise even with no overlap', () => {
    const before = record({ metrics: { mountMs: time(100, 100, 100, 100, 100) } });
    const after = record({ metrics: { mountMs: time(102, 102, 102, 102, 102) } });
    expect(compare(before, after).rows[0]?.verdict).toBe('noise');
  });

  it('leaves browser counts out when the major version differs', () => {
    const before = record({ metrics: { mountLayoutCount: metric('engine', 'count', [3]) } });
    const after = record({ browser: { name: 'chromium', version: '142.0.1' }, metrics: { mountLayoutCount: metric('engine', 'count', [9]) } });
    const result = compare(before, after);
    expect(result.engine).toBe(false);
    expect(result.rows).toHaveLength(0);
  });

  it('reports added, removed and failed cases', () => {
    const before = record({
      cases: [
        { id: 'old/10', title: 'Old', metrics: { nodes: count(1) } },
        { id: 'both/10', title: 'Both', metrics: { nodes: count(1) } },
      ],
    });
    const after = record({
      cases: [
        { id: 'both/10', title: 'Both', metrics: {}, error: 'Coachmark is not exported' },
        { id: 'new/10', title: 'New', metrics: { nodes: count(1) } },
      ],
    });
    const verdicts = Object.fromEntries(compare(before, after).rows.map((row) => [row.caseId, row.verdict]));
    expect(verdicts).toEqual({ 'old/10': 'removed', 'both/10': 'failed', 'new/10': 'added' });
  });

  it('formats a table that hides unchanged rows unless asked', () => {
    const before = record({ metrics: { nodes: count(10), documentListeners: count(2) } });
    const after = record({ metrics: { nodes: count(10), documentListeners: count(0) } });
    const result = compare(before, after);
    expect(result.rows.filter(changed)).toHaveLength(1);
    const text = format(result);
    expect(text).toContain('| menu-closed/100 | documentListeners | 2 | 0 | fewer: -2 (-100%) |');
    expect(text).not.toContain('| nodes |');
    expect(text).toContain('1 other metrics were the same');
    expect(format(result, { all: true })).toContain('| menu-closed/100 | nodes | 10 | 10 | same: 0 (0%) |');
  });

  it('keeps a failed case readable in the table', () => {
    const before = record({ cases: [{ id: 'x/10', title: 'X', metrics: {}, error: 'a | b\nsecond line' }] });
    expect(format(compare(before, before))).toContain('| x/10 | | | | failed: before: a / b second line; after: a / b second line |');
  });
});

describe('records', () => {
  it('names a record by day, ref and short SHA', () => {
    expect(recordName(record({ todae: { version: '0.7.0', sha: '9859e16da9a7', ref: 'feature/Bench Thing', dirty: false } }))).toBe(
      '2026-11-06-feature-bench-thing-9859e16',
    );
    expect(recordName(record(), 'v0.7.0')).toBe('2026-11-06-v0.7.0-aaaaaaa');
    expect(recordName(record({ todae: { version: '0.7.0', sha: 'abcdef1234', ref: 'abcdef1', dirty: false } }))).toBe('2026-11-06-abcdef1');
  });
});

describe('machine', () => {
  const facts = { platform: 'linux', arch: 'x64', cpu: 'AMD EPYC 7763 64-Core Processor', cpus: 4, memoryBytes: 16 * 1024 ** 3 };

  it('names a GitHub runner by its image, CPU and core count', () => {
    expect(describeMachine({ ...facts, env: { GITHUB_ACTIONS: 'true', ImageOS: 'ubuntu24' } })).toMatchObject({
      type: 'github-ubuntu24 x64 4cpu AMD EPYC 7763 64-Core Processor',
      ci: true,
      memoryGB: 16,
    });
  });

  it('takes BENCH_MACHINE as the type when set', () => {
    expect(describeMachine({ ...facts, env: { BENCH_MACHINE: 'ben-mbp' } }).type).toBe('ben-mbp');
  });
});

describe('slug', () => {
  it('gives a name that is safe as part of a branch name', () => {
    expect(slug('Release 0.8.0')).toBe('release-0.8.0');
    expect(slug('release..1')).toBe('release.1');
    expect(slug('v1.')).toBe('v1');
    expect(slug('x.lock')).toBe('x');
    expect(slug('a.lock-')).toBe('a');
    expect(slug('x.lock.lock')).toBe('x');
    expect(slug('!!!')).toBe('');
  });
});

describe('selectJobs', () => {
  const scenarios = [
    { id: 'menu-closed', title: 'Menu' },
    { id: 'billing-page', title: 'Billing', copies: [1] },
  ];

  it('runs each case at every size unless it fixes its own', () => {
    expect(selectJobs(scenarios, [10, 100], []).map((job) => job.id)).toEqual(['menu-closed/10', 'menu-closed/100', 'billing-page/1']);
  });

  it('keeps only cases whose id starts with a --cases entry', () => {
    expect(selectJobs(scenarios, [10, 100], ['menu-closed/100', 'billing']).map((job) => job.id)).toEqual(['menu-closed/100', 'billing-page/1']);
  });

  it('takes an entry with a size as that size only', () => {
    expect(selectJobs(scenarios, [10, 100, 1000], ['menu-closed/10']).map((job) => job.id)).toEqual(['menu-closed/10']);
  });
});
