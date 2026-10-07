'use client';

import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { useLocale } from '../lib/i18n/useLocale';

/** The token catalog's headings in the page language. The catalog itself stays on the server. */
export function TokensTableHead() {
  const words = DICTIONARIES[useLocale()].tokensTable;
  return (
    <thead>
      <tr>
        <th scope="col">{words.path}</th>
        <th scope="col">{words.context}</th>
        <th scope="col">{words.cssVar}</th>
        <th scope="col">{words.value}</th>
        <th scope="col">{words.ref}</th>
      </tr>
    </thead>
  );
}
