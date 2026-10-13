import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Calendar.Header',
  description:
    'The shown month and year, announced as they change, between buttons to the previous and next month. The buttons are named from the previousMonth and nextMonth strings and draw the chevron glyph. Takes native div attributes except children.',
  props: [],
} as const satisfies ComponentMeta;
