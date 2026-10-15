import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'parseTime',
  description:
    "parseTime(text, options) returns the Temporal.PlainTime in typed text, or null when the text is not a time. It reads an hour, an hour and minutes, or an hour, minutes and seconds, with or without the locale's words for a part of the day, such as 9:30 pm in en-US.",
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
