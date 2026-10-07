import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Card.Header',
  description: 'Top of the card, for a heading and a short description. A div; headings inside lose their outer margin.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'A heading of the level that fits the page, and optional text.',
    },
  ],
} as const satisfies ComponentMeta;
