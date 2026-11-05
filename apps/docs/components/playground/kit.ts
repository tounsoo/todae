import { formatDate, formatNumber } from '@tounsoo/todae';
import type { Locale } from '../../lib/i18n/config';
import type { Folder, Invoice } from './billing';
import type { PreviewCopy } from './previewCopy';

/** The page's today, so the made-up due dates read the same any day. */
export const TODAY = '2026-10-14';

/** What a row, the details and the search can do to an invoice. */
export type InvoiceActions = {
  open: (id: string) => void;
  markPaid: (id: string) => void;
  send: (id: string) => void;
  remind: (id: string) => void;
  flag: (id: string, flagged: boolean) => void;
  move: (id: string, folder: Folder) => void;
  archive: (id: string) => void;
};

/** What every part of the preview reads: its words, and how it writes money and dates. */
export type Kit = {
  copy: PreviewCopy;
  locale: Locale;
  money: (amount: number) => string;
  date: (iso: string) => string;
};

export function makeKit(copy: PreviewCopy, locale: Locale): Kit {
  const formatOptions = { style: 'currency', currency: copy.currency } as const;
  return {
    copy,
    locale,
    money: (amount) => formatNumber(amount, { locale, formatOptions }),
    date: (iso) => formatDate(Temporal.PlainDate.from(iso), { locale }),
  };
}

/** Days past the due date, or 0 before it. */
export function daysLate(invoice: Invoice): number {
  return Math.max(0, Temporal.PlainDate.from(invoice.due).until(TODAY).days);
}

export const STATUS_TONE = {
  draft: 'neutral',
  due: 'warning',
  overdue: 'critical',
  paid: 'success',
} as const satisfies Record<Invoice['status'], 'neutral' | 'warning' | 'critical' | 'success'>;
