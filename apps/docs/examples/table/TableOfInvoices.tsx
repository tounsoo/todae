'use client';

import { Table } from '@tounsoo/todae/table';

export default function TableOfInvoices() {
  return (
    <Table.Root>
      <Table.Caption>Invoices this quarter</Table.Caption>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell scope="col">Invoice</Table.HeaderCell>
          <Table.HeaderCell scope="col">Date</Table.HeaderCell>
          <Table.HeaderCell scope="col" style={{ textAlign: 'end' }}>
            Amount
          </Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <Table.Row>
          <Table.HeaderCell scope="row">INV-1042</Table.HeaderCell>
          <Table.Cell>2026-07-03</Table.Cell>
          <Table.Cell style={{ textAlign: 'end' }}>$1,200.00</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.HeaderCell scope="row">INV-1043</Table.HeaderCell>
          <Table.Cell>2026-08-01</Table.Cell>
          <Table.Cell style={{ textAlign: 'end' }}>$980.00</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.HeaderCell scope="row">INV-1044</Table.HeaderCell>
          <Table.Cell>2026-09-02</Table.Cell>
          <Table.Cell style={{ textAlign: 'end' }}>$1,450.00</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  );
}
