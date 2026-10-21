import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'parseDateRange',
  description:
    "parseDateRange(text, options) returns the DateRange in typed text, two dates that parseDate reads with a separator between them, such as 10/3/2026 – 10/10/2026 in en-US, or null when the text is not one or the end is before the start. It does not check a picker's min, max or isDateDisabled.",
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
