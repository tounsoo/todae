import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Skeleton.Root',
  description: 'A placeholder block from the skeleton tokens, shown while content loads. A div with no role; takes native div attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Elements that only give it a size; they are hidden.',
    },
  ],
} as const satisfies ComponentMeta;
