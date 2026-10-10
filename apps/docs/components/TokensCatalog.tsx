import { Code } from '@omsoo/todae/code';
import { Table } from '@omsoo/todae/table';
import catalog from '@omsoo/todae/tokens.json';
import { ScrollRegion } from './OverflowRegion';
import { TokensTableHead } from './TokensTableHead';

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
          <ScrollRegion key={layer}>
          <Table.Root>
            <caption>{layer}</caption>
            <TokensTableHead />
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.layer}:${row.context ?? ''}:${row.path}`}>
                  <th scope="row">
                    <Code.Root>{row.path}</Code.Root>
                  </th>
                  <td>{row.context ?? '—'}</td>
                  <td>
                    <Code.Root>{row.cssVar}</Code.Root>
                  </td>
                  <td>
                    <Code.Root>{row.cssValue}</Code.Root>
                  </td>
                  <td>{row.ref ? <Code.Root>{row.ref}</Code.Root> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table.Root>
          </ScrollRegion>
        );
      })}
    </>
  );
}
