import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'formatNumber',
  description:
    'formatNumber(value, options) returns the number as the locale writes it, such as 1,234.5 in en-US and 1.234,5 in de. formatOptions sets the style, such as percent or currency, and the digits; a plain number shows all the digits it has.',
  props: [
    {
      name: 'value',
      type: 'number',
      required: true,
      description: 'The number to write.',
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
      description: 'How the number is written, as Intl.NumberFormat takes it: style, such as percent or currency, and fraction digits.',
    },
  ],
} as const satisfies ComponentMeta;
