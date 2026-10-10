import schema from '@omsoo/todae/schema/components.json';
import { LOCALES, type Locale } from '../lib/i18n/config';
import { propDescription } from '../lib/i18n/propDescriptions';
import { PropsTableView, type PropDescription, type PropsTableRow } from './PropsTableView';

export type PropRow = {
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
  // Each prop's description in every language; the view shows the page's own.
  const rows: PropsTableRow[] = component.props.map(({ description, ...prop }) => ({
    ...prop,
    descriptions: Object.fromEntries(
      LOCALES.map((locale) => [locale, propDescription(locale, component.name, prop.name, description)]),
    ) as Record<Locale, PropDescription>,
  }));
  return <PropsTableView name={component.name} rows={rows} />;
}
