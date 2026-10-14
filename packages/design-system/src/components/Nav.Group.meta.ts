import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Nav.Group',
  description: 'A list of Nav.Item elements with an optional label above it. A div holding a ul; takes native div attributes.',
  props: [
    {
      name: 'label',
      type: 'React.ReactNode',
      required: false,
      description: 'Text shown above the list. It also names the list for screen readers.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Names the list when it has no label, or in place of it. aria-labelledby goes on the list too.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Nav.Item elements.',
    },
  ],
} as const satisfies ComponentMeta;
