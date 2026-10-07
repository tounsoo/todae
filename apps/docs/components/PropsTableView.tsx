'use client';

import { DEFAULT_LOCALE, type Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { useLocale } from '../lib/i18n/useLocale';
import { ScrollRegion } from './OverflowRegion';
import type { ComponentRow } from './PropsTable';

export type PropDescription = { text: string; lang: Locale };

export function PropsTableView({
  component,
  descriptions,
}: {
  component: ComponentRow;
  descriptions: Record<Locale, PropDescription[]>;
}) {
  const locale = useLocale();
  const words = DICTIONARIES[locale].propsTable;
  return (
    <ScrollRegion>
    <table>
      <caption>{words.caption.replace('{name}', component.name)}</caption>
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
        {component.props.map((prop, index) => {
          const description = descriptions[locale][index] ?? { text: prop.description, lang: DEFAULT_LOCALE };
          return (
            <tr key={prop.name}>
              <th scope="row">{prop.name}</th>
              <td>
                <code>{prop.type}</code>
              </td>
              <td>{prop.required ? words.yes : words.no}</td>
              <td>{prop.default ?? '—'}</td>
              <td lang={description.lang === locale ? undefined : description.lang}>{description.text}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </ScrollRegion>
  );
}
