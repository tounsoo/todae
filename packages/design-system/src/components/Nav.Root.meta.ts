import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Nav.Root',
  description: 'A nav landmark that stacks Nav.Group lists. Takes native nav attributes.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Landmark name. Give one when the page has more than one nav, such as "Docs" beside a header nav.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Nav.Group elements.',
    },
  ],
} as const satisfies ComponentMeta;
