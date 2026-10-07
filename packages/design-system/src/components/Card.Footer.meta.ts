import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Card.Footer',
  description: 'Actions at the end of the card, in a wrapping row aligned to the end. A div.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Buttons or links.',
    },
  ],
} as const satisfies ComponentMeta;
