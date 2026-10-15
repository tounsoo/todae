import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'parseDateTime',
  description:
    'parseDateTime(text, options) returns the Temporal.PlainDateTime in typed text, or null when the text is not one. It reads a date as parseDate does, then a time as parseTime does, in the order the locale writes them. It does not check a picker\'s min, max or isDateDisabled.',
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
