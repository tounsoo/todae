import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Calendar.Grid',
  description:
    'The shown month as a role="grid" table, one week to a row, labelled by Calendar.Header\'s month unless it has its own aria-label or aria-labelledby. One Tab stop; arrow keys move by day and week, Home and End to the ends of the week, Page Up and Page Down by month, and with Shift by year. Takes native table attributes except role and children.',
  props: [],
} as const satisfies ComponentMeta;
