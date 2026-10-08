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
      description: 'Wraps the text in a span with aria-current="page", marking the page you are on. Give it plain text, not a link.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'A link to the page, such as an a element or your router\'s link.',
    },
  ],
} as const satisfies ComponentMeta;
