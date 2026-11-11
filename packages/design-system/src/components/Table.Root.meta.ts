import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Table.Root',
  description: 'A native table styled from the table tokens. Takes native table attributes; build its caption, rows and cells from the Table parts.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'A Table.Caption, then Table.Head, Table.Body and Table.Foot with their rows and cells.',
    },
  ],
} as const satisfies ComponentMeta;
