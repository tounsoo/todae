import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Title',
  description: 'Heading. Wires aria-labelledby.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Title text.',
    },
  ],
} as const satisfies ComponentMeta;
