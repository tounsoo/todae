import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Breadcrumbs.Item',
  description: 'One step in the trail. An li; takes native li attributes.',
  props: [
    {
      name: 'current',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Marks the page you are on with aria-current="page". Give it plain text, not a link.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'A link to the page, such as an a element or your router\'s link.',
    },
  ],
} as const satisfies ComponentMeta;
