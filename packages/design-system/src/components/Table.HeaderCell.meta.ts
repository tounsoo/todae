import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Table.HeaderCell',
  description: 'A native th styled from the table.header tokens: a column or row header. Takes native th attributes.',
  props: [
    {
      name: 'scope',
      type: "'col' | 'row' | 'colgroup' | 'rowgroup'",
      required: false,
      description: 'Which cells it heads: col in Table.Head, row for the first cell of a body row.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The header text.',
    },
  ],
} as const satisfies ComponentMeta;
