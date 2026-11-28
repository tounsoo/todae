import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Skeleton.Root',
  description: 'A placeholder block from the skeleton tokens, shown while content loads, which pulses or shimmers. A div with no role; takes native div attributes.',
  props: [
    {
      name: 'variant',
      type: '"pulse" | "shimmer"',
      required: false,
      default: '"pulse"',
      description: 'pulse fades the block in and out; shimmer sweeps a band across it from the inline start. Both hold still under reduced motion. Sets data-variant.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Elements that only give it a size; they are hidden.',
    },
  ],
} as const satisfies ComponentMeta;
