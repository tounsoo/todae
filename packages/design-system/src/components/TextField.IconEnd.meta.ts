import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'TextField.IconEnd',
  description: 'Trailing icon slot. Decorative unless interactive.',
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
