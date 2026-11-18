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

type Sized = { chars: number; tokens: number; nav?: Nav };

/** Writes the JSON size onto the body and its nav. Two passes, so the digits settle. */
export function seal<T extends Sized>(body: T): T {
  for (let pass = 0; pass < 4; pass += 1) {
    const chars = JSON.stringify(body).length;
    const tokens = tokensOf(chars);
    const nav = body.nav;
    if (body.chars === chars && body.tokens === tokens && (!nav || (nav.chars === chars && nav.tokens === tokens))) return body;
    body.chars = chars;
    body.tokens = tokens;
    if (nav) {
      nav.chars = chars;
      nav.tokens = tokens;
    }
  }
  return body;
}

export function envelope<T extends Record<string, unknown>>(
  data: T,
  what: string,
  next: NextCall[],
  extra?: Partial<Pick<Nav, 'locale' | 'slug' | 'section'>>,
): T & Sized {
  const nav: Nav = { what, tokens: 0, chars: 0, next, ...extra };
  return seal({ ...data, chars: 0, tokens: 0, nav });
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

function overBudget(chars: number): Sized {
  return seal({
    kind: 'over-budget',
    budget: MAX_RESPONSE_CHARS,
    over: chars,
    note: `The result is ${chars} characters, over the ${MAX_RESPONSE_CHARS} character response budget. Nothing was cut. Read a section, or pass a line range to get_example.`,
    chars: 0,
    tokens: 0,
    nav: {
      what: 'over-budget',
      tokens: 0,
      chars: 0,
      next: [{ tool: 'search_docs', arguments: { query: ' ' }, why: 'Find the section instead of reading everything.' }],
    },
  });
}

function shrinkField(record: Record<string, unknown>, field: string): Record<string, unknown> | null {
  const text = record[field];
  if (typeof text !== 'string' || text.length < 2) return null;
  const offset = typeof record.offset === 'number' ? record.offset : 0;
  let lo = 1;
  let hi = text.length;
  let best = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const cut = text.slice(0, mid);
    const newline = cut.lastIndexOf('\n');
    const chunk = newline > 0 ? cut.slice(0, newline) : cut;
    const cursor = offset + chunk.length < offset + text.length ? { field, offset: offset + chunk.length } : null;
    const next = { ...record, [field]: chunk, cursor, offset: cursor ? cursor.offset : offset };
    if (JSON.stringify(next).length <= MAX_RESPONSE_CHARS) {
      best = chunk.length;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best === 0 || best >= text.length) return null;
  const chunk = text.slice(0, best);
  const newline = chunk.lastIndexOf('\n');
  const kept = newline > 0 ? chunk.slice(0, newline) : chunk;
  const nextOffset = offset + kept.length;
  return {
    ...record,
    [field]: kept,
    offset: nextOffset,
    cursor: { field, offset: nextOffset },
    note: `Continued at ${field} offset ${nextOffset}. Pass that offset to read the rest. Nothing was dropped without this cursor.`,
  };
}

function shrinkCode(record: Record<string, unknown>): Record<string, unknown> | null {
  const code = record.code;
  const start = record.startLine;
  if (typeof code !== 'string' || typeof start !== 'number') return null;
  const lines = code.split('\n');
  if (lines.length <= 1) return null;
  let lo = 1;
  let hi = lines.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const next = { ...record, code: lines.slice(0, mid).join('\n'), endLine: start + mid - 1, cursor: { startLine: start + mid } };
    if (JSON.stringify(next).length <= MAX_RESPONSE_CHARS) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best < 1) return null;
  return {
    ...record,
    code: lines.slice(0, best).join('\n'),
    endLine: start + best - 1,
    cursor: { startLine: start + best },
    note: `Lines continue at startLine ${start + best}. Nothing past that line was dropped without this cursor.`,
  };
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
  const ready = body && typeof body === 'object' && 'chars' in body && 'tokens' in body ? seal(body as Sized) : body;
  const text = JSON.stringify(ready);
  if (text.length <= MAX_RESPONSE_CHARS) return text;
  const fallback = fallbackOf(ready);
  if (fallback !== undefined) return deliver(fallback);
  const next = shrink(ready);
  if (next) return deliver(next);
  return deliver(overBudget(text.length));
}
