import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Pagination.Item',
  description: 'One page or the previous or next step, as a list item around your link or button. Takes native li attributes.',
  props: [
    {
      name: 'current',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'The page you are on: its children are drawn as the current page and marked aria-current="page". Pass text, not a link.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'A link or button, or the page number for the current page.',
    },
  ],
} as const satisfies ComponentMeta;
