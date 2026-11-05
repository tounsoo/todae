'use client';

import { Badge, Button, Card, Menu, Pagination, ScrollArea, Table, Text, ToggleGroup, VisuallyHidden, type TableSort } from '@tounsoo/todae';
import { useRef, useState, type ReactNode } from 'react';
import { sortInvoices, type Folder, type Invoice, type Sort, type SortColumn } from './billing';
import { STATUS_TONE, type InvoiceActions, type Kit } from './kit';

const PAGE_SIZE = 4;
const FOLDERS: readonly Folder[] = ['review', 'disputed'];

type Filter = 'all' | 'unpaid' | 'paid';
const FILTERS: Record<Filter, (invoice: Invoice) => boolean> = {
  all: () => true,
  unpaid: (invoice) => invoice.status === 'due' || invoice.status === 'overdue',
  paid: (invoice) => invoice.status === 'paid',
};
const isFilter = (value: string | null): value is Filter => value !== null && value in FILTERS;

function RowMenu({ invoice, kit, actions, more }: { invoice: Invoice; kit: Kit; actions: InvoiceActions; more: ReactNode }) {
  const { row, rowActions, folders } = kit.copy;
  return (
    <Menu.Root>
      <Menu.Trigger variant="ghost" aria-label={rowActions(invoice.id)} tooltip>
        <Button.Icon>{more}</Button.Icon>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.Item onSelect={() => actions.open(invoice.id)}>{row.open}</Menu.Item>
        {invoice.status === 'draft' ? (
          <Menu.Item onSelect={() => actions.send(invoice.id)}>{row.send}</Menu.Item>
        ) : (
          <Menu.Item disabled={invoice.status === 'paid'} onSelect={() => actions.remind(invoice.id)}>
            {row.remind}
          </Menu.Item>
        )}
        <Menu.Item disabled={invoice.status === 'paid' || invoice.status === 'draft'} onSelect={() => actions.markPaid(invoice.id)}>
          {row.markPaid}
        </Menu.Item>
        <Menu.Submenu>
          <Menu.SubmenuTrigger>{row.moveTo}</Menu.SubmenuTrigger>
          <Menu.SubmenuContent>
            {FOLDERS.map((folder) => (
              <Menu.Item key={folder} disabled={invoice.folder === folder} onSelect={() => actions.move(invoice.id, folder)}>
                {folders[folder]}
              </Menu.Item>
            ))}
          </Menu.SubmenuContent>
        </Menu.Submenu>
        <Menu.CheckboxItem checked={invoice.flagged} onCheckedChange={(flagged) => actions.flag(invoice.id, flagged)}>
          {row.flag}
        </Menu.CheckboxItem>
        <Menu.Separator />
        <Menu.Item onSelect={() => actions.archive(invoice.id)}>{row.archive}</Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
}

/**
 * The invoice list: sorted by a column, four to a page, each row with its own
 * menu. The id opens the invoice's details.
 */
export function InvoiceTable({
  invoices,
  kit,
  actions,
  more,
  className,
}: {
  invoices: readonly Invoice[];
  kit: Kit;
  actions: InvoiceActions;
  /** The glyph on each row's menu button. */
  more: ReactNode;
  className?: string;
}) {
  const { copy } = kit;
  const [sort, setSort] = useState<Sort>({ column: 'id', direction: 'descending' });
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>('all');
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Archive, or Mark paid under Unpaid, takes the row and its menu away. Focus
  // that went with them comes back to the card's heading, not the page's start.
  const keepFocus = (act: (id: string) => void) => (id: string) => {
    act(id);
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body) headingRef.current?.focus();
    });
  };
  const rowActions: InvoiceActions = { ...actions, archive: keepFocus(actions.archive), markPaid: keepFocus(actions.markPaid) };
  const listed = invoices.filter((invoice) => FILTERS[filter](invoice));
  const pages = Math.max(1, Math.ceil(listed.length / PAGE_SIZE));
  // A page that emptied, such as after an archive, falls back to the last one there is.
  const current = Math.min(page, pages);
  const rows = sortInvoices(listed, sort).slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const sortOf = (column: SortColumn): TableSort => (sort.column === column ? sort.direction : 'none');
  const header = (column: SortColumn, label: string, end = false) => (
    <Table.HeaderCell scope="col" sort={sortOf(column)} className={end ? 'preview-num' : undefined}>
      <Table.SortButton
        onClick={() =>
          setSort({
            column,
            direction: sort.column === column && sort.direction === 'ascending' ? 'descending' : 'ascending',
          })
        }
      >
        {label}
      </Table.SortButton>
    </Table.HeaderCell>
  );

  return (
    <Card.Root className={className}>
      <Card.Header>
        <div className="preview-card-title">
          <Text.Root as="h3" ref={headingRef} tabIndex={-1}>
            {copy.invoiceList}
          </Text.Root>
          <ToggleGroup.Root
            aria-label={copy.invoiceFilter}
            value={filter}
            onValueChange={(value) => {
              // Pressing the shown filter again keeps it, so one is always on.
              if (!isFilter(value)) return;
              setFilter(value);
              setPage(1);
            }}
          >
            <ToggleGroup.Item value="all">{copy.all}</ToggleGroup.Item>
            <ToggleGroup.Item value="unpaid">{copy.unpaid}</ToggleGroup.Item>
            <ToggleGroup.Item value="paid">{copy.statuses.paid}</ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>
      </Card.Header>
      <Card.Body>
        {/* Focusable, so it stays a named region that keys can scroll though the table holds buttons. */}
        <ScrollArea.Root axis="inline" focusable aria-label={copy.invoiceList}>
          <Table.Root>
            <Table.Head>
              <Table.Row>
                {header('id', copy.invoice)}
                {header('customer', copy.customer)}
                {header('due', copy.due)}
                <Table.HeaderCell scope="col">{copy.status}</Table.HeaderCell>
                {header('amount', copy.amount, true)}
                <Table.HeaderCell scope="col">
                  <VisuallyHidden.Root>{copy.more}</VisuallyHidden.Root>
                </Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {rows.map((invoice) => (
                <Table.Row key={invoice.id}>
                  <Table.HeaderCell scope="row">
                    {/* It opens the details in place, so it is a button, painted with the link tokens. */}
                    <button type="button" className="preview-row-link" onClick={() => actions.open(invoice.id)}>
                      {invoice.id}
                    </button>
                  </Table.HeaderCell>
                  <Table.Cell>
                    <span className="preview-customer">
                      {invoice.customer}
                      {invoice.folder ? <Badge.Root tone="info">{copy.folders[invoice.folder]}</Badge.Root> : null}
                      {invoice.flagged ? <Badge.Root tone="warning">{copy.flagged}</Badge.Root> : null}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{kit.date(invoice.due)}</Table.Cell>
                  <Table.Cell>
                    <Badge.Root tone={STATUS_TONE[invoice.status]}>{copy.statuses[invoice.status]}</Badge.Root>
                  </Table.Cell>
                  <Table.Cell className="preview-num">{kit.money(invoice.amount)}</Table.Cell>
                  <Table.Cell className="preview-row-menu">
                    <RowMenu invoice={invoice} kit={kit} actions={rowActions} more={more} />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          {rows.length === 0 ? <Text.Root tone="muted">{copy.noInvoices}</Text.Root> : null}
        </ScrollArea.Root>
      </Card.Body>
      <Card.Footer>
        <Pagination.Root aria-label={copy.invoicePages}>
          {Array.from({ length: pages }, (_, index) => index + 1).map((item) => (
            <Pagination.Item key={item}>
              <button type="button" aria-current={item === current ? 'page' : undefined} onClick={() => setPage(item)}>
                {item}
              </button>
            </Pagination.Item>
          ))}
        </Pagination.Root>
      </Card.Footer>
    </Card.Root>
  );
}
