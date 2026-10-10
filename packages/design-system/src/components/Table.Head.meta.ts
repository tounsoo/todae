import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Table.Head',
  description: 'A native thead styled from the table tokens: its header cells sit above a stronger rule. Takes native thead attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Table.Row parts with the column headers.',
    },
  ],
} as const satisfies ComponentMeta;
