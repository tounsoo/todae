import { tokensOf } from './units';

/**
 * Below the point where Claude Code spills a tool result into a file (50_000
 * characters). The cap is on the JSON the tool returns, applied in `deliver`,
 * so a tool cannot trim its own text and stay quiet about it.
 */
export const MAX_RESPONSE_CHARS = 40_000;

/**
 * A default page read past this returns the outline and the intro.
 * 4_000 tokens is 16_000 characters, under half of the response budget, so the
 * next call (a section, or an example) still fits beside it. Claude Code warns
 * above 10_000 tokens. The median docs page is about 1_000 tokens, so the
 * common read is still the whole page. The count is chars/4 of the JSON.
 */
export const LARGE_PAGE_TOKENS = 4_000;

const FALLBACK = Symbol('todae.mcp.fallback');

export type NextCall = { tool: string; arguments: Record<string, string | number | boolean>; why: string };

export type Nav = {
  what: string;
  locale?: 'en' | 'ko';
  slug?: string;
  section?: string;
  tokens: number;
  chars: number;
  next: NextCall[];
};

type WithNav = { nav?: Nav };

/**
 * Writes the JSON size onto `nav` only. A result often has its own `tokens`
 * list (the catalog) or `chars` field, and a size written on the body would replace it.
 */
export function seal<T extends WithNav>(body: T): T {
  const nav = body.nav;
  if (!nav) return body;
  for (let pass = 0; pass < 4; pass += 1) {
    const chars = JSON.stringify(body).length;
    const tokens = tokensOf(chars);
    if (nav.chars === chars && nav.tokens === tokens) return body;
    nav.chars = chars;
    nav.tokens = tokens;
  }
  return body;
}

export function envelope<T extends Record<string, unknown>>(
  data: T,
  what: string,
  next: NextCall[],
  extra?: Partial<Pick<Nav, 'locale' | 'slug' | 'section'>>,
): T & { nav: Nav } {
  const nav: Nav = { what, tokens: 0, chars: 0, next, ...extra };
  return seal({ ...data, nav });
}

/**
 * The longest leading slice of `items` whose projected JSON fits the budget,
 * leaving room for the nav `ok` adds. `cursor.offset` is the next index.
 */
export function fitSlice<T, R extends object>(
  items: readonly T[],
  offset: number,
  project: (slice: readonly T[], cursor: { offset: number } | null) => R,
): R {
  const start = Math.max(0, Math.trunc(offset));
  const rest = items.slice(start);
  const room = MAX_RESPONSE_CHARS - 800;
  const build = (count: number): R => {
    const cursor = start + count < items.length ? { offset: start + count } : null;
    return project(rest.slice(0, count), cursor);
  };
  if (rest.length === 0 || JSON.stringify(build(rest.length)).length <= room) return build(rest.length);
  let lo = 1;
  let hi = rest.length - 1;
  let best = 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (JSON.stringify(build(mid)).length <= room) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return build(best);
}

/** A smaller body `deliver` returns when `body` does not fit. Hidden from JSON. */
export function withFallback<T extends object>(body: T, fallback: unknown): T {
  Object.defineProperty(body, FALLBACK, { value: fallback, enumerable: false });
  return body;
}

function fallbackOf(body: unknown): unknown {
  if (!body || typeof body !== 'object' || !(FALLBACK in body)) return undefined;
  return (body as Record<symbol, unknown>)[FALLBACK];
}

function overBudget(chars: number): { nav: Nav } {
  return seal({
    kind: 'over-budget',
    budget: MAX_RESPONSE_CHARS,
    over: chars,
    note: `The result is ${chars} characters, over the ${MAX_RESPONSE_CHARS} character response budget. Nothing was cut. Read a section, or pass a line range to get_example.`,
    nav: {
      what: 'over-budget',
      tokens: 0,
      chars: 0,
      next: [{ tool: 'search_docs', arguments: { query: 'todae' }, why: 'Find the section instead of reading everything.' }],
    },
  });
}

function continuationNote(field: string, nextOffset: number): string {
  return `Continued at ${field} offset ${nextOffset}. Pass that offset to read the rest. Nothing was dropped without this cursor.`;
}

/**
 * The longest prefix of `record[field]` that fits once the note and cursor are in the JSON.
 * `record.offset` is where this text starts in the original field. `resumeBuild` has already
 * sliced a continuation, so the offset on the record is that start.
 */
function shrinkField(record: Record<string, unknown>, field: string): Record<string, unknown> | null {
  const text = record[field];
  if (typeof text !== 'string' || text.length < 2) return null;
  const start = typeof record.offset === 'number' ? record.offset : 0;
  if (start < 0) return null;
  const packed = (chunk: string): Record<string, unknown> | null => {
    if (chunk.length < 1 || chunk.length >= text.length) return null;
    const nextOffset = start + chunk.length;
    const next: Record<string, unknown> = {
      ...record,
      [field]: chunk,
      offset: start,
      cursor: { field, offset: nextOffset },
      note: continuationNote(field, nextOffset),
    };
    return JSON.stringify(next).length <= MAX_RESPONSE_CHARS ? next : null;
  };
  let lo = 1;
  let hi = text.length - 1;
  let best: Record<string, unknown> | null = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const cut = text.slice(0, mid);
    const newline = cut.lastIndexOf('\n');
    const chunk = newline > 0 ? cut.slice(0, newline) : cut;
    const fit = packed(chunk);
    if (fit) {
      best = fit;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function shrinkCode(record: Record<string, unknown>): Record<string, unknown> | null {
  const code = record.code;
  const start = record.startLine;
  if (typeof code !== 'string' || typeof start !== 'number') return null;
  const lines = code.split('\n');
  if (lines.length <= 1) return null;
  const packed = (count: number): Record<string, unknown> | null => {
    const next: Record<string, unknown> = {
      ...record,
      code: lines.slice(0, count).join('\n'),
      endLine: start + count - 1,
      cursor: { startLine: start + count },
      note: `Lines continue at startLine ${start + count}. Nothing past that line was dropped without this cursor.`,
    };
    return JSON.stringify(next).length <= MAX_RESPONSE_CHARS ? next : null;
  };
  let lo = 1;
  let hi = lines.length - 1;
  let best: Record<string, unknown> | null = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const fit = packed(mid);
    if (fit) {
      best = fit;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function shrink(body: unknown): unknown {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record.code === 'string' && typeof record.startLine === 'number') {
    const next = shrinkCode(record);
    if (next) return next;
  }
  for (const field of ['markdown', 'css', 'overrideTypes']) {
    if (typeof record[field] === 'string') {
      const next = shrinkField(record, field);
      if (next) return next;
    }
  }
  return null;
}

/**
 * The JSON a tool returns. Over the budget, returns the attached outline or a
 * continuation cursor. It never slices a string and presents the slice as the
 * whole result.
 */
export function deliver(body: unknown): string {
  const ready = body && typeof body === 'object' && 'nav' in body ? seal(body as WithNav) : body;
  const text = JSON.stringify(ready);
  if (text.length <= MAX_RESPONSE_CHARS) return text;
  const fallback = fallbackOf(ready);
  if (fallback !== undefined) return deliver(fallback);
  const next = shrink(ready);
  if (next) return deliver(next);
  return deliver(overBudget(text.length));
}
