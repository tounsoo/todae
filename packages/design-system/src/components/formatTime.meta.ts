import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'formatTime',
  description:
    "formatTime(time, options) returns the time in the locale's short time style, such as 9:30 PM in en-US and 21:30 in de, or in its medium style, with seconds, when the time has seconds. parseTime reads the text back.",
  props: [
    {
      name: 'time',
      type: 'Temporal.PlainTime',
      required: true,
      description: 'The time to write.',
    },
    {
      name: 'options.locale',
      type: 'string',
      required: false,
      description: "The locale, such as ko. The runtime's own when not set.",
    },
  ],
} as const satisfies ComponentMeta;
