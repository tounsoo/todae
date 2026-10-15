import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'formatDateTime',
  description:
    'formatDateTime(value, options) returns the date and time as the locale writes them, the date in numbers as formatDate does and the time in hours and minutes, or with seconds when it has seconds, such as 10/13/2026, 9:30 PM in en-US. parseDateTime reads the text back.',
  props: [
    {
      name: 'value',
      type: 'Temporal.PlainDateTime',
      required: true,
      description: 'The date and time to write.',
    },
    {
      name: 'options.locale',
      type: 'string',
      required: false,
      description: "The locale, such as ko. The runtime's own when not set.",
    },
  ],
} as const satisfies ComponentMeta;
