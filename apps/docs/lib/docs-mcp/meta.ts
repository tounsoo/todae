import schema from '@omsoo.design/todae/schema/components.json';

export type PropMeta = {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
};

export type ComponentMeta = {
  name: string;
  description: string;
  props: PropMeta[];
};

function isProp(value: unknown): value is PropMeta {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.name === 'string' &&
    typeof row.type === 'string' &&
    typeof row.required === 'boolean' &&
    typeof row.description === 'string' &&
    (row.default === undefined || typeof row.default === 'string')
  );
}

function isComponent(value: unknown): value is ComponentMeta {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.name === 'string' &&
    typeof row.description === 'string' &&
    Array.isArray(row.props) &&
    row.props.every(isProp)
  );
}

function readComponents(): ComponentMeta[] {
  if (
    typeof schema !== 'object' ||
    schema === null ||
    !('components' in schema) ||
    !Array.isArray(schema.components) ||
    !schema.components.every(isComponent)
  ) {
    throw new Error('Invalid components schema document');
  }
  return schema.components;
}

const components = readComponents();

export function listComponentMeta(): readonly ComponentMeta[] {
  return components;
}

export function unknownComponent(name: string): Error {
  return new Error(`Unknown component "${name}". Call list_components.`);
}

/** Exact name, then case-insensitive. Namespace is the segment before the first dot. */
export function resolveName(
  query: string,
): { kind: 'component'; component: ComponentMeta } | { kind: 'namespace'; name: string } {
  const exact = components.find((row) => row.name === query);
  if (exact) return { kind: 'component', component: exact };

  const folded = query.toLowerCase();
  const ci = components.filter((row) => row.name.toLowerCase() === folded);
  if (ci.length === 1 && ci[0]) return { kind: 'component', component: ci[0] };

  if (!query.includes('.')) {
    const parts = components.filter((row) => {
      const dot = row.name.indexOf('.');
      return dot > 0 && row.name.slice(0, dot).toLowerCase() === folded;
    });
    const head = parts[0]?.name.slice(0, parts[0].name.indexOf('.'));
    if (head && parts.every((row) => row.name.startsWith(`${head}.`))) {
      return { kind: 'namespace', name: head };
    }
  }

  throw unknownComponent(query);
}

export function partsOf(name: string): ComponentMeta[] {
  const prefix = `${name}.`;
  return components.filter((row) => row.name.startsWith(prefix));
}
