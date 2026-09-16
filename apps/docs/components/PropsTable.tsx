import schema from '@todae/design-system/schema/components.json';

type PropRow = {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
};

type ComponentRow = {
  name: string;
  description: string;
  props: PropRow[];
};

function isPropRow(value: unknown): value is PropRow {
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

function isComponentRow(value: unknown): value is ComponentRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.name === 'string' &&
    typeof row.description === 'string' &&
    Array.isArray(row.props) &&
    row.props.every(isPropRow)
  );
}

function readComponent(name: string): ComponentRow {
  if (
    typeof schema !== 'object' ||
    schema === null ||
    !('components' in schema) ||
    !Array.isArray(schema.components)
  ) {
    throw new Error('Invalid components schema document');
  }
  const match = schema.components.find((row) => isComponentRow(row) && row.name === name);
  if (!match || !isComponentRow(match)) {
    throw new Error(`Unknown component "${name}" in schema/components.json`);
  }
  return match;
}

export function PropsTable({ name }: { name: string }) {
  const component = readComponent(name);
  return (
    <table>
      <caption>{component.name} props</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Type</th>
          <th scope="col">Required</th>
          <th scope="col">Default</th>
          <th scope="col">Description</th>
        </tr>
      </thead>
      <tbody>
        {component.props.map((prop) => (
          <tr key={prop.name}>
            <th scope="row">{prop.name}</th>
            <td>
              <code>{prop.type}</code>
            </td>
            <td>{prop.required ? 'yes' : 'no'}</td>
            <td>{prop.default ?? '—'}</td>
            <td>{prop.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
