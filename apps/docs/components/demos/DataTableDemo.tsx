'use client';

import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Field,
  Label,
  Pagination,
  paginationRange,
  ScrollArea,
  Stack,
  Table,
  Text,
  Toolbar,
  useAnnouncer,
  useSelection,
  VisuallyHidden,
  type BadgeTone,
  type TableSort,
} from '@tounsoo/todae';
import { SearchX } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

// Todae ships no icons. These come from Lucide; any icon library works.

type Status = 'Paid' | 'Due' | 'Overdue';
type Invoice = { id: string; customer: string; status: Status; amount: number };

const INVOICES: Invoice[] = [
  { id: 'INV-1042', customer: 'Atlas Labs', status: 'Paid', amount: 1200 },
  { id: 'INV-1043', customer: 'Beacon Health', status: 'Overdue', amount: 980 },
  { id: 'INV-1044', customer: 'Cedar & Co', status: 'Paid', amount: 1450 },
  { id: 'INV-1045', customer: 'Delta Freight', status: 'Due', amount: 310 },
  { id: 'INV-1046', customer: 'Atlas Labs', status: 'Due', amount: 2200 },
  { id: 'INV-1047', customer: 'Ember Studio', status: 'Paid', amount: 640 },
  { id: 'INV-1048', customer: 'Fjord Outdoors', status: 'Overdue', amount: 1875 },
  { id: 'INV-1049', customer: 'Beacon Health', status: 'Paid', amount: 415 },
  { id: 'INV-1050', customer: 'Granite Works', status: 'Due', amount: 3020 },
  { id: 'INV-1051', customer: 'Harbor Coffee', status: 'Paid', amount: 95 },
  { id: 'INV-1052', customer: 'Cedar & Co', status: 'Due', amount: 760 },
  { id: 'INV-1053', customer: 'Iris Media', status: 'Overdue', amount: 1330 },
];

const PAGE_SIZE = 5;
const TONES: Record<Status, BadgeTone> = { Paid: 'success', Due: 'neutral', Overdue: 'critical' };
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

type Column = 'id' | 'customer' | 'amount';
type Sorted = { column: Column; direction: 'ascending' | 'descending' };

function compare(a: Invoice, b: Invoice, column: Column) {
  if (column === 'amount') return a.amount - b.amount;
  return a[column].localeCompare(b[column]);
}

const invoices = (count: number) => `${count} ${count === 1 ? 'invoice' : 'invoices'}`;

export function DataTableInvoices() {
  const searchId = useId();
  const search = useRef<HTMLInputElement>(null);
  const selectAll = useRef<HTMLInputElement>(null);
  const announce = useAnnouncer();
  const [rows, setRows] = useState(INVOICES);
  const [query, setQuery] = useState('');
  const [sorted, setSorted] = useState<Sorted>({ column: 'id', direction: 'ascending' });
  const [page, setPage] = useState(1);

  // Filter, then sort, then cut out the page. All three are your product's.
  const needle = query.trim().toLowerCase();
  const matches = rows
    .filter((row) => `${row.id} ${row.customer}`.toLowerCase().includes(needle))
    .sort((a, b) => (sorted.direction === 'ascending' ? 1 : -1) * compare(a, b, sorted.column));
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = matches.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const selection = useSelection({ keys: pageRows.map((row) => row.id) });
  const selected = selection.value.length;

  // Announce the number of matches once typing settles, and only when it changed.
  const announced = useRef(matches.length);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (announced.current === matches.length) return;
      announced.current = matches.length;
      announce(matches.length === 0 ? 'No invoices found' : `${invoices(matches.length)} found`);
    }, 500);
    return () => clearTimeout(timer);
  }, [matches.length, announce]);

  const sortOf = (column: Column): TableSort => (sorted.column === column ? sorted.direction : 'none');
  const sortBy = (column: Column) => {
    setSorted({
      column,
      direction: sorted.column === column && sorted.direction === 'ascending' ? 'descending' : 'ascending',
    });
    setPage(1);
  };

  const changeQuery = (next: string) => {
    setQuery(next);
    setPage(1);
    selection.clear();
  };

  const markPaid = () => {
    const ids = new Set(selection.value);
    setRows(rows.map((row) => (ids.has(row.id) ? { ...row, status: 'Paid' } : row)));
    announce(`${invoices(ids.size)} marked paid`);
  };

  const remove = () => {
    const ids = new Set(selection.value);
    const left = rows.filter((row) => !ids.has(row.id));
    // The toolbar's buttons turn disabled once nothing is selected, which
    // drops their focus, so move it to the table before they do.
    (left.length > 0 ? selectAll.current : search.current)?.focus();
    setRows(left);
    selection.clear();
    announce(`${invoices(ids.size)} deleted`);
  };

  const step = (to: number, label: string) => (
    <Pagination.Item>
      <button
        type="button"
        aria-disabled={to < 1 || to > pageCount ? true : undefined}
        onClick={() => to >= 1 && to <= pageCount && setPage(to)}
      >
        {label}
      </button>
    </Pagination.Item>
  );

  // A full inline size keeps a wide table scrolling inside the example
  // instead of widening it.
  return (
    <Stack.Root style={{ inlineSize: '100%' }}>
      <Field.Group>
        <Label.Root htmlFor={searchId}>Search invoices</Label.Root>
        <Field.Root id={searchId}>
          <Field.TextInput ref={search} type="search" value={query} onChange={(event) => changeQuery(event.target.value)} />
        </Field.Root>
      </Field.Group>
      <Stack.Root direction="row" align="center" justify="between" wrap>
        <Text.Root tone="muted">{selected === 0 ? 'No invoices selected' : `${invoices(selected)} selected`}</Text.Root>
        <Toolbar.Root aria-label="Selected invoices">
          <Button.Root variant="secondary" disabled={selected === 0} onClick={markPaid}>
            Mark paid
          </Button.Root>
          <Button.Root variant="secondary" disabled={selected === 0} onClick={remove}>
            Delete
          </Button.Root>
        </Toolbar.Root>
      </Stack.Root>
      <ScrollArea.Root axis="inline" focusable aria-label="Invoices table">
        <Table.Root>
          <Table.Caption>Invoices</Table.Caption>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell scope="col">
                <Checkbox.Root ref={selectAll} {...selection.getSelectAllProps()}>
                  <VisuallyHidden.Root>Select all invoices on this page</VisuallyHidden.Root>
                </Checkbox.Root>
              </Table.HeaderCell>
              <Table.HeaderCell scope="col" sort={sortOf('id')}>
                <Table.SortButton onClick={() => sortBy('id')}>Invoice</Table.SortButton>
              </Table.HeaderCell>
              <Table.HeaderCell scope="col" sort={sortOf('customer')}>
                <Table.SortButton onClick={() => sortBy('customer')}>Customer</Table.SortButton>
              </Table.HeaderCell>
              <Table.HeaderCell scope="col">Status</Table.HeaderCell>
              <Table.HeaderCell scope="col" sort={sortOf('amount')} style={{ textAlign: 'end' }}>
                <Table.SortButton onClick={() => sortBy('amount')}>Amount</Table.SortButton>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {pageRows.map((row) => (
              <Table.Row key={row.id} selected={selection.isSelected(row.id)}>
                <Table.Cell>
                  <Checkbox.Root {...selection.getCheckboxProps(row.id)}>
                    <VisuallyHidden.Root>{`Select ${row.id}`}</VisuallyHidden.Root>
                  </Checkbox.Root>
                </Table.Cell>
                <Table.HeaderCell scope="row">{row.id}</Table.HeaderCell>
                <Table.Cell>{row.customer}</Table.Cell>
                <Table.Cell>
                  <Badge.Root tone={TONES[row.status]}>{row.status}</Badge.Root>
                </Table.Cell>
                <Table.Cell style={{ textAlign: 'end' }}>{dollars.format(row.amount)}</Table.Cell>
              </Table.Row>
            ))}
            {pageRows.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <EmptyState.Root>
                    <EmptyState.Icon>
                      <SearchX />
                    </EmptyState.Icon>
                    <EmptyState.Title as="h3">No invoices found</EmptyState.Title>
                    <EmptyState.Description>
                      {query ? `Nothing matches “${query}”. Check the spelling or try a shorter search.` : 'There are no invoices left.'}
                    </EmptyState.Description>
                    {query && (
                      <EmptyState.Actions>
                        <Button.Root
                          variant="secondary"
                          onClick={() => {
                            changeQuery('');
                            search.current?.focus();
                          }}
                        >
                          Clear search
                        </Button.Root>
                      </EmptyState.Actions>
                    )}
                  </EmptyState.Root>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </ScrollArea.Root>
      {pageCount > 1 && (
        <Pagination.Root aria-label="Invoice pages">
          {step(current - 1, 'Previous')}
          {paginationRange({ page: current, count: pageCount }).map((item) =>
            typeof item === 'number' ? (
              <Pagination.Item key={item}>
                <button type="button" aria-current={item === current ? 'page' : undefined} onClick={() => setPage(item)}>
                  {item}
                </button>
              </Pagination.Item>
            ) : (
              <Pagination.Ellipsis key={item} />
            ),
          )}
          {step(current + 1, 'Next')}
        </Pagination.Root>
      )}
    </Stack.Root>
  );
}
