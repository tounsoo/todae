import type { CatalogEntry, PatternMeta } from '../types';

export type Criteria = {
  id: string;
  kind: 'component' | 'part' | 'hook' | 'provider' | 'pattern';
  summary: string;
  prefer: readonly string[];
  avoid: readonly string[];
  intents: readonly string[];
  requires: readonly string[];
};

function isPattern(entry: CatalogEntry): entry is PatternMeta {
  return 'tree' in entry;
}

export function toCriteria(entry: CatalogEntry): Criteria {
  if (isPattern(entry)) {
    return {
      id: entry.id,
      kind: 'pattern',
      summary: entry.description,
      prefer: entry.whenToUse,
      avoid: entry.whenNotToUse,
      intents: entry.intents,
      requires: entry.uses,
    };
  }
  return {
    id: entry.name,
    kind: entry.kind,
    summary: entry.description,
    prefer: entry.whenToUse,
    avoid: entry.whenNotToUse,
    intents: entry.intents,
    requires: (entry.related ?? []).filter((rel) => rel.relation === 'requires').map((rel) => rel.id),
  };
}
