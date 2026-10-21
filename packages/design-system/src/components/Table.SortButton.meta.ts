import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Table.SortButton',
  description:
    'A native button for a sortable column, inside a Table.HeaderCell that takes sort. It draws the sort glyph after its children, from the header cell\'s data-sort: shown on a sorted column, turned when it is descending, and shown dimmed on hover and focus otherwise. It does not sort; set the cell\'s sort from onClick. After a click it announces the column\'s next aria-sort or data-sort change through useAnnouncer. Takes native button attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The column label. It names the button, and the announcement uses its text, or aria-label when set.',
    },
    {
      name: 'onClick',
      type: '(event: React.MouseEvent<HTMLButtonElement>) => void',
      required: false,
      description: 'Where the product sorts. It runs first; calling preventDefault() skips the announcement.',
    },
  ],
} as const satisfies ComponentMeta;
