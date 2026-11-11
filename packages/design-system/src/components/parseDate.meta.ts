import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'parseDate',
  description:
    "parseDate(text, options) returns the Temporal.PlainDate in typed text, or null when the text is not a date. It reads a date in numbers in the order formatDate writes them, or in the locale's medium, long or full Intl date style. It does not check a picker's min, max or isDateDisabled.",
  props: [
    {
      name: 'text',
      type: 'string',
      required: true,
      description: 'The typed text.',
    },
    {
      name: 'options.locale',
      type: 'string',
      required: false,
      description: "The locale, such as ko. The runtime's own when not set.",
    },
  ],
} as const satisfies ComponentMeta;
