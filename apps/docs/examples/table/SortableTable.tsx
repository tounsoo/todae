'use client';

import { Table, type TableSort } from '@tounsoo/todae';
import { useState } from 'react';

const INVOICES = [
  { id: 'INV-1042', status: 'Paid', amount: 1200 },
  { id: 'INV-1043', status: 'Overdue', amount: 980 },
  { id: 'INV-1044', status: 'Paid', amount: 1450 },
  { id: 'INV-1045', status: 'Draft', amount: 310 },
];

type Column = 'id' | 'amount';

type Sorted = { column: Column; direction: 'ascending' | 'descending' };

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function SortableTable() {
  const [sorted, setSorted] = useState<Sorted>({ column: 'id', direction: 'ascending' });
  const rows = [...INVOICES].sort((a, b) => {
    const order = sorted.column === 'id' ? a.id.localeCompare(b.id) : a.amount - b.amount;
    return sorted.direction === 'ascending' ? order : -order;
  });
  const sortOf = (column: Column): TableSort => (sorted.column === column ? sorted.direction : 'none');
  const sortBy = (column: Column) =>
    setSorted({
      column,
      direction: sorted.column === column && sorted.direction === 'ascending' ? 'descending' : 'ascending',
    });
  return (
    <Table.Root>
      <Table.Caption>Invoices this quarter</Table.Caption>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell scope="col" sort={sortOf('id')}>
            <Table.SortButton onClick={() => sortBy('id')}>Invoice</Table.SortButton>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">Status</Table.HeaderCell>
          <Table.HeaderCell scope="col" sort={sortOf('amount')} style={{ textAlign: 'end' }}>
            <Table.SortButton onClick={() => sortBy('amount')}>Amount</Table.SortButton>
          </Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row key={row.id}>
            <Table.HeaderCell scope="row">{row.id}</Table.HeaderCell>
            <Table.Cell>{row.status}</Table.Cell>
            <Table.Cell style={{ textAlign: 'end' }}>{dollars.format(row.amount)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
