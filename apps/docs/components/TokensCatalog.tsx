import { Code } from '@omsoo/todae/code';
import { Table } from '@omsoo/todae/table';
import catalog from '@omsoo/todae/tokens.json';
import { ScrollRegion } from './ScrollRegion';
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
            <Table.Caption>{layer}</Table.Caption>
            <TokensTableHead />
            <Table.Body>
              {rows.map((row) => (
                <Table.Row key={`${row.layer}:${row.context ?? ''}:${row.path}`}>
                  <Table.HeaderCell scope="row">
                    <Code.Root>{row.path}</Code.Root>
                  </Table.HeaderCell>
                  <Table.Cell>{row.context ?? '—'}</Table.Cell>
                  <Table.Cell>
                    <Code.Root>{row.cssVar}</Code.Root>
                  </Table.Cell>
                  <Table.Cell>
                    <Code.Root>{row.cssValue}</Code.Root>
                  </Table.Cell>
                  <Table.Cell>{row.ref ? <Code.Root>{row.ref}</Code.Root> : '—'}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          </ScrollRegion>
        );
      })}
    </>
  );
}
