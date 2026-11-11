import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'DensityProvider',
  description: 'Sets data-density for spacing-only compact, comfortable, or spacious.',
  props: [
    {
      name: 'density',
      type: '"compact" | "comfortable" | "spacious"',
      required: false,
      default: 'the enclosing DensityProvider\'s, or "comfortable"',
      description: 'Spacing density written to data-density.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Subtree that inherits density tokens.',
    },
  ],
} as const satisfies ComponentMeta;
