import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Calendar.Header',
  description:
    'The shown month and year, announced as they change, between buttons to the previous and next month. The month and year is a button that swaps the grid for a page of twelve years and back; while the years show, the buttons go to the previous and next page. The buttons are named from the previousMonth and nextMonth strings, or previousYears and nextYears, and they and the heading draw the chevron glyph. Takes native div attributes except children.',
  props: [],
} as const satisfies ComponentMeta;
