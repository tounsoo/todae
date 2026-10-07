import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Card.Root',
  description: 'A bordered surface from the card tokens. A div with no role; takes native div attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Card parts, or any content.',
    },
  ],
} as const satisfies ComponentMeta;
