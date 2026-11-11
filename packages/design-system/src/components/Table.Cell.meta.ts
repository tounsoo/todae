import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Table.Cell',
  description: 'A native td styled from the table tokens. Takes native td attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The cell content.',
    },
  ],
} as const satisfies ComponentMeta;
