import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Icon',
  description: 'Order-only icon. Decorative unless interactive. No side prop.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Icon or control.',
    },
    {
      name: 'interactive',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'When false, the wrapper is aria-hidden.',
    },
  ],
} as const satisfies ComponentMeta;
