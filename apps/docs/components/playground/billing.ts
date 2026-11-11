/**
 * The playground preview's billing app: made-up invoices and what can happen to them.
 * State lives in the page, nothing is sent anywhere, and a reload starts over.
 */

export type InvoiceStatus = 'draft' | 'due' | 'overdue' | 'paid';

/** Where Move to files an invoice. Null is the main list. */
export type Folder = 'review' | 'disputed';

export type Invoice = {
  id: string;
  customer: string;
  /** In the locale's currency, in whole units with cents as decimals. */
  amount: number;
  /** An ISO date, such as 2026-10-02. */
  due: string;
  status: InvoiceStatus;
  flagged: boolean;
  folder: Folder | null;
};

/** One line in the Activity card, newest first. */
export type ActivityEntry =
  | { kind: 'paid'; id: string; customer: string }
  | { kind: 'reminded'; id: string; customer: string }
  | { kind: 'sent'; id: string; customer: string }
  | { kind: 'created'; id: string; customer: string }
  | { kind: 'moved'; id: string; folder: Folder }
  | { kind: 'archived'; id: string };

export type BillingState = {
  invoices: readonly Invoice[];
  /** Archived invoices, kept so Undo can put one back where it was. */
  archived: readonly { invoice: Invoice; index: number }[];
  activity: readonly ActivityEntry[];
};

export type BillingAction =
  | { type: 'create'; invoice: Invoice }
  | { type: 'remove'; id: string }
  | { type: 'markPaid'; id: string }
  | { type: 'unpay'; id: string; status: InvoiceStatus }
  | { type: 'send'; id: string }
  | { type: 'remind'; id: string }
  | { type: 'flag'; id: string; flagged: boolean }
  | { type: 'move'; id: string; folder: Folder }
  | { type: 'archive'; id: string }
  | { type: 'unarchive'; id: string };

export function startBilling(invoices: readonly Invoice[], activity: readonly ActivityEntry[]): BillingState {
  return { invoices, archived: [], activity };
}

function update(state: BillingState, id: string, change: (invoice: Invoice) => Invoice): readonly Invoice[] {
  return state.invoices.map((invoice) => (invoice.id === id ? change(invoice) : invoice));
}

function find(state: BillingState, id: string): Invoice | undefined {
  return state.invoices.find((invoice) => invoice.id === id);
}

export function billingReducer(state: BillingState, action: BillingAction): BillingState {
  switch (action.type) {
    case 'create':
      return {
        ...state,
        invoices: [action.invoice, ...state.invoices],
        activity: [{ kind: 'created', id: action.invoice.id, customer: action.invoice.customer }, ...state.activity],
      };
    case 'remove':
      return {
        ...state,
        invoices: state.invoices.filter((invoice) => invoice.id !== action.id),
        // Undo of Create: the invoice never was, so nothing done to it stays in the activity.
        activity: state.activity.filter((entry) => entry.id !== action.id),
      };
    case 'markPaid': {
      const invoice = find(state, action.id);
      if (!invoice || invoice.status === 'paid') return state;
      return {
        ...state,
        invoices: update(state, action.id, (it) => ({ ...it, status: 'paid' })),
        activity: [{ kind: 'paid', id: invoice.id, customer: invoice.customer }, ...state.activity],
      };
    }
    case 'unpay': {
      // Undo of Mark paid: only the status goes back, so a flag or a move made since stays.
      const first = state.activity.findIndex((entry) => entry.kind === 'paid' && entry.id === action.id);
      return {
        ...state,
        invoices: update(state, action.id, (it) => ({ ...it, status: action.status })),
        activity: first === -1 ? state.activity : state.activity.filter((_, index) => index !== first),
      };
    }
    case 'send': {
      const invoice = find(state, action.id);
      if (!invoice || invoice.status !== 'draft') return state;
      return {
        ...state,
        invoices: update(state, action.id, (it) => ({ ...it, status: 'due' })),
        activity: [{ kind: 'sent', id: invoice.id, customer: invoice.customer }, ...state.activity],
      };
    }
    case 'remind': {
      const invoice = find(state, action.id);
      if (!invoice) return state;
      return { ...state, activity: [{ kind: 'reminded', id: invoice.id, customer: invoice.customer }, ...state.activity] };
    }
    case 'flag':
      return { ...state, invoices: update(state, action.id, (it) => ({ ...it, flagged: action.flagged })) };
    case 'move':
      return {
        ...state,
        invoices: update(state, action.id, (it) => ({ ...it, folder: action.folder })),
        activity: [{ kind: 'moved', id: action.id, folder: action.folder }, ...state.activity],
      };
    case 'archive': {
      const index = state.invoices.findIndex((invoice) => invoice.id === action.id);
      const invoice = state.invoices[index];
      if (!invoice) return state;
      return {
        invoices: state.invoices.filter((_, at) => at !== index),
        archived: [...state.archived, { invoice, index }],
        activity: [{ kind: 'archived', id: invoice.id }, ...state.activity],
      };
    }
    case 'unarchive': {
      const kept = state.archived.find((entry) => entry.invoice.id === action.id);
      if (!kept) return state;
      const invoices = [...state.invoices];
      invoices.splice(Math.min(kept.index, invoices.length), 0, kept.invoice);
      return {
        invoices,
        archived: state.archived.filter((entry) => entry !== kept),
        activity: state.activity.filter((entry) => !(entry.kind === 'archived' && entry.id === action.id)),
      };
    }
  }
}

/** Paid money, money still owed, and how many invoices are late. */
export function totals(invoices: readonly Invoice[]) {
  let paid = 0;
  let open = 0;
  let overdue = 0;
  for (const invoice of invoices) {
    if (invoice.status === 'paid') paid += invoice.amount;
    if (invoice.status === 'due' || invoice.status === 'overdue') open += invoice.amount;
    if (invoice.status === 'overdue') overdue += 1;
  }
  return { paid, open, overdue };
}

export type SortColumn = 'id' | 'customer' | 'due' | 'amount';
export type Sort = { column: SortColumn; direction: 'ascending' | 'descending' };

export function sortInvoices(invoices: readonly Invoice[], sort: Sort): Invoice[] {
  const order = (a: Invoice, b: Invoice) => {
    switch (sort.column) {
      case 'amount':
        return a.amount - b.amount;
      case 'due':
        return a.due.localeCompare(b.due);
      case 'customer':
        return a.customer.localeCompare(b.customer);
      case 'id':
        return a.id.localeCompare(b.id);
    }
  };
  return [...invoices].sort((a, b) => (sort.direction === 'ascending' ? order(a, b) : order(b, a)));
}

/** The next free invoice number after the highest one there is, archived ones included. */
export function nextInvoiceId(state: BillingState): string {
  const all = [...state.invoices, ...state.archived.map((entry) => entry.invoice)];
  const highest = Math.max(0, ...all.map((invoice) => Number(invoice.id.replace(/\D/g, '')) || 0));
  return `INV-${highest + 1}`;
}
