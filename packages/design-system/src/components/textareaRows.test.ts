import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTextareaRows } from './textareaRows';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const cases: {
  input: { rows?: unknown; maxRows?: unknown };
  rows: number;
  maxRows?: number;
  warnings: string[];
}[] = [
  { input: {}, rows: 3, warnings: [] },
  { input: { maxRows: 2 }, rows: 2, maxRows: 2, warnings: [] },
  { input: { maxRows: 10 }, rows: 3, maxRows: 10, warnings: [] },
  { input: { rows: 2.7, maxRows: 6.9 }, rows: 2, maxRows: 6, warnings: [] },
  { input: { rows: 0 }, rows: 3, warnings: ['Field.Textarea: rows must be a finite number from 1 to 1000'] },
  { input: { rows: -4 }, rows: 3, warnings: ['Field.Textarea: rows must be a finite number from 1 to 1000'] },
  { input: { rows: 0.5 }, rows: 3, warnings: ['Field.Textarea: rows must be a finite number from 1 to 1000'] },
  { input: { rows: Number.NaN }, rows: 3, warnings: ['Field.Textarea: rows must be a finite number from 1 to 1000'] },
  {
    input: { rows: Number.POSITIVE_INFINITY },
    rows: 3,
    warnings: ['Field.Textarea: rows must be a finite number from 1 to 1000'],
  },
  {
    input: { maxRows: Number.NEGATIVE_INFINITY },
    rows: 3,
    warnings: ['Field.Textarea: maxRows must be a finite number from 1 to 1000'],
  },
  { input: { rows: '4' }, rows: 3, warnings: ['Field.Textarea: rows must be a finite number from 1 to 1000'] },
  { input: { rows: 'abc' }, rows: 3, warnings: ['Field.Textarea: rows must be a finite number from 1 to 1000'] },
  { input: { rows: null }, rows: 3, warnings: ['Field.Textarea: rows must be a finite number from 1 to 1000'] },
  { input: { maxRows: '4' }, rows: 3, warnings: ['Field.Textarea: maxRows must be a finite number from 1 to 1000'] },
  { input: { rows: 1001 }, rows: 1000, warnings: ['Field.Textarea: rows must be a finite number from 1 to 1000'] },
  {
    input: { maxRows: 5000 },
    rows: 3,
    maxRows: 1000,
    warnings: ['Field.Textarea: maxRows must be a finite number from 1 to 1000'],
  },
  {
    input: { rows: 5, maxRows: 2 },
    rows: 5,
    maxRows: 5,
    warnings: ['Field.Textarea: maxRows is below rows; raising maxRows to rows'],
  },
  { input: { rows: 4 }, rows: 4, warnings: [] },
  { input: { rows: 4, maxRows: 8 }, rows: 4, maxRows: 8, warnings: [] },
];

describe('resolveTextareaRows', () => {
  it.each(cases)('$input → rows $rows maxRows $maxRows', ({ input, rows, maxRows, warnings }) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = resolveTextareaRows(input);
    expect(result.rows).toBe(rows);
    expect(Number.isInteger(result.rows)).toBe(true);
    expect(result.maxRows).toBe(maxRows);
    if (result.maxRows !== undefined) expect(Number.isInteger(result.maxRows)).toBe(true);
    expect(result.warnings).toEqual(warnings);
  });

  it('does not warn in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = resolveTextareaRows({ rows: 0, maxRows: 1 });
    expect(warn).not.toHaveBeenCalled();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('warns in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    resolveTextareaRows({ rows: '3); color: red' });
    expect(warn).toHaveBeenCalledWith('Field.Textarea: rows must be a finite number from 1 to 1000');
  });
});
