import catalogJson from '../../catalog/catalog.json';
import {
  getComponent as readComponent,
  getPattern as readPattern,
  listComponents as readComponents,
  listForIntent as readForIntent,
  listPatterns as readPatterns,
} from './lookup.ts';
import { search as searchCatalog } from './search.ts';
import { INTENTS, type Catalog, type EntryKind, type Intent } from './types.ts';

export const catalog: Catalog = catalogJson;
export { INTENTS };
export type {
  Catalog,
  CatalogEntry,
  ComponentMeta,
  EntryKind,
  Intent,
  PatternMeta,
  PatternNode,
  PropMeta,
  Relation,
  SlotMeta,
} from './types.ts';
export type { CatalogHit } from './search.ts';
export { createSearch } from './search.ts';


export function getComponent(id: string, source: Catalog = catalog) {
  return readComponent(id, source);
}

export function getPattern(id: string, source: Catalog = catalog) {
  return readPattern(id, source);
}

export function listComponents(filter?: { kind?: EntryKind; intent?: Intent }, source: Catalog = catalog) {
  return readComponents(filter, source);
}

export function listPatterns(filter?: { intent?: Intent }, source: Catalog = catalog) {
  return readPatterns(filter, source);
}

export function listForIntent(
  intent: Intent,
  opts?: { kinds?: EntryKind[]; includePatterns?: boolean },
  source: Catalog = catalog,
) {
  return readForIntent(intent, opts, source);
}

export function search(
  query: string,
  opts?: { limit?: number; kinds?: EntryKind[]; includePatterns?: boolean; intents?: Intent[] },
  source: Catalog = catalog,
) {
  return searchCatalog(query, opts, source);
}

