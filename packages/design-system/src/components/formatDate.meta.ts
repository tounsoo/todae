import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'formatDate',
  description:
    'formatDate(date, options) returns the date as the locale writes it in numbers, such as 10/13/2026 in en-US, 13.10.2026 in de and 2026. 10. 13. in ko,. A date in another calendar is written as the same day in the Gregorian calendar.',
  props: [
    {
      name: 'date',
      type: 'Temporal.PlainDate',
      required: true,
      description: 'The date to write.',
    },
    {
      name: 'options.locale',
      type: 'string',
      required: false,
      description: "The locale, such as ko. The runtime's own when not set.",
    },
  ],
} as const satisfies ComponentMeta;
