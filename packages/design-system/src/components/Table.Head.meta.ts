import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Table.Head',
  description: 'A native thead. The Table.HeaderCell parts in its rows sit above a stronger rule. Takes native thead attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Table.Row parts with the column headers.',
    },
  ],
} as const satisfies ComponentMeta;
