import { getComponent, getPattern, listComponents, listForIntent, listPatterns } from './lookup.ts';
import { tokenize } from './tokenize.ts';
import type { Catalog, CatalogEntry, ComponentMeta, EntryKind, Intent, PatternMeta } from './types.ts';

export type CatalogHit<T extends CatalogEntry = CatalogEntry> = {
  entry: T;
  score: number;
  matched: readonly ('id' | 'name' | 'intents' | 'description' | 'whenToUse' | 'whenNotToUse')[];
};

type Field = CatalogHit['matched'][number];

const WEIGHT: Record<Field, number> = {
  id: 5,
  name: 5,
  intents: 4,
  description: 2,
  whenToUse: 2,
  whenNotToUse: -1,
};

type Indexed = {
  entry: CatalogEntry;
  id: string;
  fields: Record<Field, readonly string[]>;
};

function isPattern(entry: CatalogEntry): entry is PatternMeta {
  return 'id' in entry && 'tree' in entry;
}

function indexEntry(entry: CatalogEntry): Indexed {
  const id = isPattern(entry) ? entry.id : entry.name;
  return {
    entry,
    id,
    fields: {
      id: tokenize(id),
      name: tokenize(entry.name),
      intents: entry.intents.flatMap((intent) => tokenize(intent)),
      description: tokenize(entry.description),
      whenToUse: entry.whenToUse.flatMap((line) => tokenize(line)),
      whenNotToUse: entry.whenNotToUse.flatMap((line) => tokenize(line)),
    },
  };
}

function scoreEntry(query: readonly string[], indexed: Indexed): CatalogHit | undefined {
  const matched: Field[] = [];
  let score = 0;
  for (const field of Object.keys(WEIGHT) as Field[]) {
    if (query.some((token) => indexed.fields[field].includes(token))) {
      matched.push(field);
      score += WEIGHT[field];
    }
  }
  if (matched.length === 0) return undefined;
  return { entry: indexed.entry, score, matched };
}

export function search(
  query: string,
  opts: { limit?: number; kinds?: EntryKind[]; includePatterns?: boolean; intents?: Intent[] } | undefined,
  source: Catalog,
): CatalogHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const includePatterns = opts?.includePatterns !== false;
  const rows: Indexed[] = [
    ...source.components
      .filter((entry) => !opts?.kinds || opts.kinds.includes(entry.kind))
      .filter((entry) => !opts?.intents || opts.intents.some((intent) => entry.intents.includes(intent)))
      .map(indexEntry),
    ...(includePatterns
      ? source.patterns
          .filter((entry) => !opts?.intents || opts.intents.some((intent) => entry.intents.includes(intent)))
          .map(indexEntry)
      : []),
  ];
  return rows
    .map((row) => scoreEntry(tokens, row))
    .filter((hit): hit is CatalogHit => hit !== undefined)
    .sort((a, b) => b.score - a.score || (isPattern(a.entry) ? a.entry.id : a.entry.name).localeCompare(isPattern(b.entry) ? b.entry.id : b.entry.name))
    .slice(0, opts?.limit ?? rows.length);
}

export function createSearch(source: Catalog): {
  search: (
    query: string,
    opts?: { limit?: number; kinds?: EntryKind[]; includePatterns?: boolean; intents?: Intent[] },
  ) => CatalogHit[];
  listForIntent: (
    intent: Intent,
    opts?: { kinds?: EntryKind[]; includePatterns?: boolean },
  ) => Array<ComponentMeta | PatternMeta>;
  getComponent: (id: string) => ComponentMeta | undefined;
  getPattern: (id: string) => PatternMeta | undefined;
  listComponents: (filter?: { kind?: EntryKind; intent?: Intent }) => ComponentMeta[];
  listPatterns: (filter?: { intent?: Intent }) => PatternMeta[];
} {
  const index = [
    ...source.components.map(indexEntry),
    ...source.patterns.map(indexEntry),
  ];
  return {
    search(query, opts) {
      const tokens = tokenize(query);
      if (tokens.length === 0) return [];
      const includePatterns = opts?.includePatterns !== false;
      return index
        .filter((row) => {
          if (isPattern(row.entry)) return includePatterns;
          if (opts?.kinds && !opts.kinds.includes(row.entry.kind)) return false;
          return true;
        })
        .filter((row) => !opts?.intents || opts.intents.some((intent) => row.entry.intents.includes(intent)))
        .map((row) => scoreEntry(tokens, row))
        .filter((hit): hit is CatalogHit => hit !== undefined)
        .sort((a, b) => b.score - a.score || (isPattern(a.entry) ? a.entry.id : a.entry.name).localeCompare(isPattern(b.entry) ? b.entry.id : b.entry.name))
        .slice(0, opts?.limit ?? index.length);
    },
    listForIntent: (intent, opts) => listForIntent(intent, opts, source),
    getComponent: (id) => getComponent(id, source),
    getPattern: (id) => getPattern(id, source),
    listComponents: (filter) => listComponents(filter, source),
    listPatterns: (filter) => listPatterns(filter, source),
  };
}
