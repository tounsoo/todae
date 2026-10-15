import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Chip.Overflow',
  description:
    'A display-only +N chip: a span with the visible +N hidden from assistive technology and a visually hidden name. It takes no focus; put it in a button to make it a control.',
  props: [
    {
      name: 'overflowCount',
      type: 'number',
      required: true,
      description: 'The N in +N.',
    },
    {
      name: 'overflowLabel',
      type: '(n: number) => string',
      required: false,
      description: 'Name read for +N. Default is the moreChips string from StringsProvider, {n} more in English.',
    },
  ],
} as const satisfies ComponentMeta;
