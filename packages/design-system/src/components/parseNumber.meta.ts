import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'parseNumber',
  description:
    'parseNumber(text, options) returns the number in typed text, or null when the text is not a number in the locale, such as 1.234,5 in de for 1234.5. It reads the text with or without grouping, and with or without the percent sign, currency sign or unit that formatOptions writes.',
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
      description: "The locale, such as de. The runtime's own when not set.",
    },
    {
      name: 'options.formatOptions',
      type: 'NumberFormatOptions',
      required: false,
      description: 'How the number is written, as Intl.NumberFormat takes it. A percent style reads 13 as 0.13.',
    },
  ],
} as const satisfies ComponentMeta;
