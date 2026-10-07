'use client';

import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { useLocale } from '../lib/i18n/useLocale';
import { ScrollRegion } from './OverflowRegion';
import type { PropRow } from './PropsTable';

export type PropDescription = { text: string; lang: Locale };

export type PropsTableRow = Omit<PropRow, 'description'> & { descriptions: Record<Locale, PropDescription> };

export function PropsTableView({
  name,
  rows,
}: {
  name: string;
  rows: PropsTableRow[];
}) {
  const locale = useLocale();
  const words = DICTIONARIES[locale].propsTable;
  return (
    <ScrollRegion>
    // Its own lang: an untranslated page wraps its English content in lang="en".
    <table lang={locale}>
      <caption>{words.caption.replace('{name}', name)}</caption>
      <thead>
        <tr>
          <th scope="col">{words.name}</th>
          <th scope="col">{words.type}</th>
          <th scope="col">{words.required}</th>
          <th scope="col">{words.default}</th>
          <th scope="col">{words.description}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((prop) => {
          const description = prop.descriptions[locale];
          return (
            <tr key={prop.name}>
              <th scope="row">{prop.name}</th>
              <td>
                <code>{prop.type}</code>
              </td>
              <td>{prop.required ? words.yes : words.no}</td>
              <td>{prop.default ?? '—'}</td>
              <td lang={description.lang}>{description.text}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </ScrollRegion>
  );
}
