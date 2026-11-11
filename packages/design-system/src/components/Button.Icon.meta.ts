import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Button.Icon',
  description: 'Order-only decorative icon. Always aria-hidden. No side prop.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Icon graphic.',
    },
  ],
} as const satisfies ComponentMeta;
