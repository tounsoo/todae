import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Table.Root',
  description: 'A native table styled from the table tokens. Takes native table attributes; write the caption, rows and cells as plain elements inside.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: true,
      description: 'A caption, then thead, tbody and tfoot with their rows and cells.',
    },
  ],
} as const satisfies ComponentMeta;
