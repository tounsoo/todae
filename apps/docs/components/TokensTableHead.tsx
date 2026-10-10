'use client';

import { Table } from '@omsoo/todae/table';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { useLocale } from '../lib/i18n/useLocale';

/** The token catalog's headings in the page language. The catalog itself stays on the server. */
export function TokensTableHead() {
  const words = DICTIONARIES[useLocale()].tokensTable;
  return (
    <Table.Head>
      <Table.Row>
        <Table.HeaderCell scope="col">{words.path}</Table.HeaderCell>
        <Table.HeaderCell scope="col">{words.context}</Table.HeaderCell>
        <Table.HeaderCell scope="col">{words.cssVar}</Table.HeaderCell>
        <Table.HeaderCell scope="col">{words.value}</Table.HeaderCell>
        <Table.HeaderCell scope="col">{words.ref}</Table.HeaderCell>
      </Table.Row>
    </Table.Head>
  );
}
