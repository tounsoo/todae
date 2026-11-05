import { describe, expect, it } from 'vitest';
import { billingReducer, nextInvoiceId, sortInvoices, startBilling, totals, type Invoice } from './billing';

const invoice = (id: string, status: Invoice['status'], amount: number, due = '2026-10-20'): Invoice => ({
  id,
  customer: `Customer ${id}`,
  amount,
  due,
  status,
  flagged: false,
  folder: null,
});

const START = startBilling(
  [invoice('INV-3', 'draft', 30, '2026-10-30'), invoice('INV-2', 'overdue', 20, '2026-10-01'), invoice('INV-1', 'paid', 10, '2026-09-20')],
  [],
);

describe('billing', () => {
  it('marks an invoice paid, and Undo puts it and the activity back as they were', () => {
    const before = START.invoices[1]!;
    const paid = billingReducer(START, { type: 'markPaid', id: 'INV-2' });
    expect(paid.invoices[1]?.status).toBe('paid');
    expect(paid.activity).toEqual([{ kind: 'paid', id: 'INV-2', customer: 'Customer INV-2' }]);
    // A paid invoice is paid once.
    expect(billingReducer(paid, { type: 'markPaid', id: 'INV-2' })).toBe(paid);
    const undone = billingReducer(paid, { type: 'restore', invoice: before });
    expect(undone.invoices).toEqual(START.invoices);
    expect(undone.activity).toEqual([]);
  });

  it('sends only a draft', () => {
    const sent = billingReducer(START, { type: 'send', id: 'INV-3' });
    expect(sent.invoices[0]?.status).toBe('due');
    expect(billingReducer(sent, { type: 'send', id: 'INV-3' })).toBe(sent);
  });

  it('archives an invoice and puts it back where it was', () => {
    const archived = billingReducer(START, { type: 'archive', id: 'INV-2' });
    expect(archived.invoices.map((it) => it.id)).toEqual(['INV-3', 'INV-1']);
    const back = billingReducer(archived, { type: 'unarchive', id: 'INV-2' });
    expect(back.invoices).toEqual(START.invoices);
    expect(back.archived).toEqual([]);
    expect(back.activity).toEqual([]);
  });

  it('numbers a new invoice past every one there is, archived ones too', () => {
    const archived = billingReducer(START, { type: 'archive', id: 'INV-3' });
    expect(nextInvoiceId(archived)).toBe('INV-4');
    const created = billingReducer(archived, { type: 'create', invoice: invoice('INV-4', 'due', 40) });
    expect(created.invoices[0]?.id).toBe('INV-4');
    expect(billingReducer(created, { type: 'remove', id: 'INV-4' }).activity).toEqual(archived.activity);
  });

  it('flags and files an invoice', () => {
    const flagged = billingReducer(START, { type: 'flag', id: 'INV-1', flagged: true });
    expect(flagged.invoices[2]?.flagged).toBe(true);
    const moved = billingReducer(flagged, { type: 'move', id: 'INV-1', folder: 'disputed' });
    expect(moved.invoices[2]?.folder).toBe('disputed');
  });

  it('adds up what is paid and what is still owed', () => {
    expect(totals(START.invoices)).toEqual({ paid: 10, open: 20, overdue: 1 });
  });

  it('sorts by any column, either way', () => {
    const ids = (sorted: Invoice[]) => sorted.map((it) => it.id);
    expect(ids(sortInvoices(START.invoices, { column: 'amount', direction: 'ascending' }))).toEqual(['INV-1', 'INV-2', 'INV-3']);
    expect(ids(sortInvoices(START.invoices, { column: 'due', direction: 'descending' }))).toEqual(['INV-3', 'INV-2', 'INV-1']);
  });
});
