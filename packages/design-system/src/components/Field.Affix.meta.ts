import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Affix',
  description: 'Order-only text adornment. Not clickable. No side prop.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Affix content. Strings render as text.',
    },
  ],
} as const satisfies ComponentMeta;
