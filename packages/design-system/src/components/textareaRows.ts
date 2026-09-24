const DEFAULT_ROWS = 3;
const MIN_ROWS = 1;
const MAX_ROWS = 1000;

export type TextareaRows = {
  rows: number;
  maxRows?: number;
  warnings: string[];
};

function floored(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.floor(value);
}

function clamp(name: 'rows' | 'maxRows', raw: unknown, warnings: string[]): number | null {
  if (raw === undefined) return null;
  const value = floored(raw);
  if (value === null || value < MIN_ROWS) {
    warnings.push(`Field.Textarea: ${name} must be a finite number from 1 to 1000`);
    return null;
  }
  if (value > MAX_ROWS) {
    warnings.push(`Field.Textarea: ${name} must be a finite number from 1 to 1000`);
    return MAX_ROWS;
  }
  return value;
}

export function resolveTextareaRows(input: { rows?: unknown; maxRows?: unknown }): TextareaRows {
  const warnings: string[] = [];
  const rows = clamp('rows', input.rows, warnings);
  let maxRows = clamp('maxRows', input.maxRows, warnings) ?? undefined;
  if (maxRows !== undefined && rows !== null && maxRows < rows) {
    warnings.push('Field.Textarea: maxRows is below rows; raising maxRows to rows');
    maxRows = rows;
  }
  if (process.env.NODE_ENV !== 'production') {
    for (const warning of warnings) console.warn(warning);
  }
  return {
    rows: rows ?? (maxRows !== undefined ? Math.min(DEFAULT_ROWS, maxRows) : DEFAULT_ROWS),
    maxRows,
    warnings,
  };
}
