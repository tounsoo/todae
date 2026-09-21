import catalogJson from '../../catalog/catalog.json';
import {
  getComponent as readComponent,
  getPattern as readPattern,
  listComponents as readComponents,
  listForIntent as readForIntent,
  listPatterns as readPatterns,
} from './lookup';
import { search as searchCatalog } from './search';
import { INTENTS, type Catalog, type EntryKind, type Intent } from './types';

export const catalog = catalogJson as Catalog;
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
} from './types';
export type { CatalogHit } from './search';
export { createSearch } from './search';
export { toRenderCatalog } from './adapters/render';
export { toCandidateRecipe } from './adapters/recipe';
export { toCriteria } from './adapters/criteria';
export type { PropSchema, PropTypeSchema, RenderCatalog, RenderComponent, SlotSchema } from './adapters/render';
export type { CandidateRecipe } from './adapters/recipe';
export type { Criteria } from './adapters/criteria';

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

