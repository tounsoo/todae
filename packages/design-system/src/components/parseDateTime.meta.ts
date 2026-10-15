import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'parseDateTime',
  description:
    'parseDateTime(text, options) returns the Temporal.PlainDateTime in typed text, or null when the text is not one. It reads a date and a time in the order the locale writes them, such as 10/13/2026 9:30 pm or Oct 13, 2026 at 9:30 PM in en-US. It does not check a picker\'s min, max or isDateDisabled.',
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
