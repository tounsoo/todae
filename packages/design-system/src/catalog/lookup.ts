import type { Catalog, ComponentMeta, EntryKind, Intent, PatternMeta } from './types.ts';

export function getComponent(id: string, source: Catalog): ComponentMeta | undefined {
  return source.components.find((entry) => entry.name === id);
}

export function getPattern(id: string, source: Catalog): PatternMeta | undefined {
  return source.patterns.find((entry) => entry.id === id);
}

export function listComponents(
  filter: { kind?: EntryKind; intent?: Intent } | undefined,
  source: Catalog,
): ComponentMeta[] {
  return source.components.filter((entry) => {
    if (filter?.kind && entry.kind !== filter.kind) return false;
    if (filter?.intent && !entry.intents.includes(filter.intent)) return false;
    return true;
  });
}

const KIND_ORDER: Record<EntryKind, number> = { component: 0, part: 1, hook: 2, provider: 3 };

export function listPatterns(filter: { intent?: Intent } | undefined, source: Catalog): PatternMeta[] {
  return source.patterns.filter((entry) => !filter?.intent || entry.intents.includes(filter.intent));
}

export function listForIntent(
  intent: Intent,
  opts: { kinds?: EntryKind[]; includePatterns?: boolean } | undefined,
  source: Catalog,
): Array<ComponentMeta | PatternMeta> {
  const kinds = opts?.kinds;
  const components = source.components
    .filter((entry) => entry.intents.includes(intent) && (!kinds || kinds.includes(entry.kind)))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name));
  const patterns =
    opts?.includePatterns === false
      ? []
      : source.patterns.filter((entry) => entry.intents.includes(intent)).sort((a, b) => a.id.localeCompare(b.id));
  return [...components, ...patterns];
}
