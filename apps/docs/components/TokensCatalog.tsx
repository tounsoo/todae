import catalog from '@tounsoo/todae/tokens.json';

type TokenRow = {
  path: string;
  type: string;
  cssVar: string;
  cssValue: string;
  ref: string | null;
  layer: string;
  context: string | null;
};

function isRow(value: unknown): value is TokenRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.path === 'string' &&
    typeof row.type === 'string' &&
    typeof row.cssVar === 'string' &&
    typeof row.cssValue === 'string' &&
    (row.ref === null || typeof row.ref === 'string') &&
    typeof row.layer === 'string' &&
    (row.context === null || typeof row.context === 'string')
  );
}

function readCatalog(): TokenRow[] {
  if (typeof catalog !== 'object' || catalog === null || !('tokens' in catalog) || !Array.isArray(catalog.tokens)) {
    throw new Error('Invalid tokens.json catalog');
  }
  if (!catalog.tokens.every(isRow)) throw new Error('Invalid token row in tokens.json');
  return catalog.tokens;
}

const LAYERS = ['core', 'appearance', 'density', 'contract', 'variant'] as const;

export function TokensCatalog() {
  const tokens = readCatalog();
  return (
    <>
      {LAYERS.map((layer) => {
        const rows = tokens.filter((row) => row.layer === layer);
        if (rows.length === 0) return null;
        return (
          <div key={layer} className="scroll-x">
          <table>
            <caption>{layer}</caption>
            <thead>
              <tr>
                <th scope="col">Path</th>
                <th scope="col">Context</th>
                <th scope="col">CSS variable</th>
                <th scope="col">Value</th>
                <th scope="col">Ref</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.layer}:${row.context ?? ''}:${row.path}`}>
                  <th scope="row">
                    <code>{row.path}</code>
                  </th>
                  <td>{row.context ?? '—'}</td>
                  <td>
                    <code>{row.cssVar}</code>
                  </td>
                  <td>
                    <code>{row.cssValue}</code>
                  </td>
                  <td>{row.ref ? <code>{row.ref}</code> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        );
      })}
    </>
  );
}
