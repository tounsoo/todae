import catalog from '@tounsoo/todae/catalog.json';

function readComponent(name: string) {
  const match = catalog.components.find((row) => row.name === name);
  if (!match) throw new Error(`Unknown component "${name}" in catalog.json`);
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
