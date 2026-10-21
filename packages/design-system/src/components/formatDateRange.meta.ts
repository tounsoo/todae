import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'formatDateRange',
  description:
    "formatDateRange(range, options) returns the range as the locale writes it, both dates as formatDate writes them with the locale's range separator between, such as 10/3/2026 – 10/10/2026 in en-US and 2026. 10. 3. ~ 2026. 10. 10. in ko.",
  props: [
    {
      name: 'range',
      type: 'DateRange',
      required: true,
      description: 'The range to write, as { start, end }.',
    },
    {
      name: 'options.locale',
      type: 'string',
      required: false,
      description: "The locale, such as ko. The runtime's own when not set.",
    },
  ],
} as const satisfies ComponentMeta;
