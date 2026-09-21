import {
  catalog,
  getComponent,
  getPattern,
  INTENTS,
  listComponents,
  listForIntent,
  listPatterns,
  search,
  toCandidateRecipe,
  toCriteria,
  toRenderCatalog,
  type EntryKind,
  type Intent,
} from '@tounsoo/todae/catalog';

export function list_components(filter?: { kind?: EntryKind; intent?: Intent }) {
  return listComponents(filter);
}

export function get_component(id: string) {
  return getComponent(id);
}

export function list_patterns(filter?: { intent?: Intent }) {
  return listPatterns(filter);
}

export function get_pattern(id: string) {
  return getPattern(id);
}

export function list_for_intent(intent: Intent, opts?: { kinds?: EntryKind[]; includePatterns?: boolean }) {
  return listForIntent(intent, opts);
}

export function search_catalog(
  query: string,
  opts?: { limit?: number; kinds?: EntryKind[]; includePatterns?: boolean; intents?: Intent[] },
) {
  return search(query, opts);
}

export function list_intents() {
  return INTENTS;
}

export function to_render_catalog(names?: string[]) {
  if (!names) return toRenderCatalog(catalog.components);
  const entries = names.map((name) => getComponent(name));
  if (entries.some((entry) => entry === undefined)) return undefined;
  return toRenderCatalog(entries.filter((entry) => entry !== undefined));
}

export function to_candidate_recipe(id: string) {
  const pattern = getPattern(id);
  return pattern ? toCandidateRecipe(pattern) : undefined;
}

export function to_criteria(id: string) {
  const entry = getComponent(id) ?? getPattern(id);
  return entry ? toCriteria(entry) : undefined;
}
