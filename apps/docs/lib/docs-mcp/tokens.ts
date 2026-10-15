import catalog from '@omsoo.design/todae/tokens.json';
import { DOCS_ORIGIN } from '../origin';

export const LAYERS = ['core', 'appearance', 'density', 'contract'] as const;
export type TokenLayer = (typeof LAYERS)[number];

export type CatalogToken = {
  path: string;
  type: string;
  cssVar: string;
  cssValue: string;
  ref: string | null;
  layer: TokenLayer;
  context: string | null;
};

const SOURCE = 'todae-docs' as const;
const TOKENS_URL = `${DOCS_ORIGIN}/tokens`;

function isCatalogToken(value: unknown): value is CatalogToken {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.path === 'string' &&
    typeof row.type === 'string' &&
    typeof row.cssVar === 'string' &&
    typeof row.cssValue === 'string' &&
    (row.ref === null || typeof row.ref === 'string') &&
    LAYERS.includes(row.layer as TokenLayer) &&
    (row.context === null || typeof row.context === 'string')
  );
}

let cached: CatalogToken[] | null = null;

/**
 * Every catalog row: one per token, or one per context for a token a modifier
 * sets. Read on first use, so a bad catalog fails the token tools only.
 */
export function catalogTokens(): readonly CatalogToken[] {
  if (cached) return cached;
  const rows: unknown = (catalog as { tokens?: unknown }).tokens;
  if (!Array.isArray(rows) || !rows.every(isCatalogToken)) throw new Error('Invalid token catalog');
  cached = rows;
  return rows;
}

export type ListTokensOptions = { prefix?: string; layer?: TokenLayer; limit?: number; offset?: number };

/** Catalog rows whose path is `prefix` or starts with `prefix.`, in catalog order. */
export function listTokens({ prefix, layer, limit = 200, offset = 0 }: ListTokensOptions = {}) {
  const matches = catalogTokens().filter(
    (row) =>
      (prefix === undefined || row.path === prefix || row.path.startsWith(`${prefix}.`)) &&
      (layer === undefined || row.layer === layer),
  );
  return {
    tokens: matches.slice(offset, offset + limit),
    total: matches.length,
    offset,
    hasMore: offset + limit < matches.length,
    docsUrl: TOKENS_URL,
    source: SOURCE,
  };
}

const VAR_RE = /var\((--todae-[a-z0-9-]+)/g;

/** True when the row's CSS value reads `cssVar`, as an alias, a color channel or an alpha. */
function readsVar(row: CatalogToken, cssVar: string): boolean {
  for (const hit of row.cssValue.matchAll(VAR_RE)) if (hit[1] === cssVar) return true;
  return false;
}

export function getToken(path: string) {
  const tokens = catalogTokens();
  const rows = tokens.filter((row) => row.path === path);
  const first = rows[0];
  if (!first) throw new Error(`Unknown token "${path}". Call list_tokens.`);
  const referencedBy = [...new Set(tokens.filter((row) => row.path !== path && readsVar(row, first.cssVar)).map((row) => row.path))];
  return {
    path,
    type: first.type,
    layer: first.layer,
    cssVar: first.cssVar,
    values: rows.map(({ context, cssValue, ref }) => ({ context, cssValue, ref })),
    referencedBy,
    docsUrl: TOKENS_URL,
    source: SOURCE,
  };
}
