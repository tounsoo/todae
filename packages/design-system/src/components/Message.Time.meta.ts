import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Message.Time',
  description:
    'When the message was sent, as a time element from the message.time tokens. dateTime is the instant in UTC, and the text is the value written for locale with Intl in the value\'s time zone and the Gregorian calendar, in the short time style unless dateStyle or timeStyle is set, such as 9:41 AM in en-US. Takes native time attributes.',
  props: [
    {
      name: 'value',
      type: 'Temporal.ZonedDateTime',
      required: true,
      description: 'When the message was sent, in the time zone to show it in.',
    },
    {
      name: 'locale',
      type: 'string',
      required: false,
      description: 'The locale to write it in, such as "ko". The runtime\'s own when not set, so set it when a server renders the message.',
    },
    {
      name: 'dateStyle',
      type: '"full" | "long" | "medium" | "short"',
      required: false,
      description: 'Intl\'s dateStyle. With neither style set, the time is written in the short time style.',
    },
    {
      name: 'timeStyle',
      type: '"full" | "long" | "medium" | "short"',
      required: false,
      description: 'Intl\'s timeStyle. With neither style set, it is short.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Text to show in place of the formatted value, such as "2 min ago". dateTime still comes from value.',
    },
  ],
} as const satisfies ComponentMeta;
