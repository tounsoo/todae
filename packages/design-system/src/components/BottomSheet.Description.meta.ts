import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Description',
  description: 'Supporting text. Wires aria-describedby.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Description text.',
    },
  ],
} as const satisfies ComponentMeta;
