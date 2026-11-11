import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Pagination.Item',
  description:
    'One page or the previous or next step, as a list item around your link or button. Its control is drawn as the current page when it has aria-current="page" and muted when it has aria-disabled="true". Takes native li attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'A link or button.',
    },
  ],
} as const satisfies ComponentMeta;
