import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Table.Row',
  description: 'A native tr. Takes native tr attributes.',
  props: [
    {
      name: 'selected',
      type: 'boolean',
      required: false,
      description: 'Marks the row selected: sets data-selected and a fill from the table.row.bg.selected token. It sets no ARIA; the row\'s checkbox carries the state.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Table.HeaderCell and Table.Cell parts.',
    },
  ],
} as const satisfies ComponentMeta;
