import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'DensityProvider',
  kind: 'provider',
  description: 'Sets data-density for spacing-only compact, comfortable, or spacious.',
  whenToUse: [
    'Sets data-density for spacing-only compact, comfortable, or spacious.',
  ],
  whenNotToUse: [
    'Does not change type size or color. Nested providers override.',
  ],
  intents: [
    'density',
  ],
  related: [
    { id: 'ThemeProvider', relation: 'pairsWith' },
  ],
  props: [
    {
      name: 'density',
      type: '"compact" | "comfortable" | "spacious"',
      required: false,
      default: '"comfortable"',
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
