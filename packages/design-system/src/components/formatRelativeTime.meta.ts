import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'formatRelativeTime',
  description:
    "formatRelativeTime(value, now, options) returns how long before or after now the time value is, as the locale writes it, such as 3 minutes ago, yesterday or in 2 weeks in en and 3분 전, 어제 or 2주 후 in ko. Under a day it counts whole seconds, minutes or hours that have passed; from a day it counts days, weeks, months or years between the two dates in value's time zone and the Gregorian calendar.",
  props: [
    {
      name: 'value',
      type: 'Temporal.ZonedDateTime',
      required: true,
      description: 'The time to write, in the time zone its dates are counted in.',
    },
    {
      name: 'now',
      type: 'Temporal.ZonedDateTime | Temporal.Instant',
      required: true,
      description: 'The time to count from, such as Temporal.Now.instant().',
    },
    {
      name: 'options.locale',
      type: 'string',
      required: false,
      description: "The locale, such as ko. The runtime's own when not set.",
    },
    {
      name: 'options.style',
      type: "'long' | 'short' | 'narrow'",
      required: false,
      description: 'How long the words are, as Intl.RelativeTimeFormat takes it: long (3 minutes ago), short (3 min. ago) or narrow. long when not set.',
    },
    {
      name: 'options.numeric',
      type: "'auto' | 'always'",
      required: false,
      description: 'auto writes words such as yesterday and now where the locale has them; always writes a number, such as 1 day ago. auto when not set.',
    },
  ],
} as const satisfies ComponentMeta;
