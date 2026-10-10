import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Group',
  description:
    'Column that stacks a Label.Root or caption, the control, Description.Root and ErrorMessage.Root, spaced by field.label.gap. Renders a div outside Field.Root.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'A label or caption, the control, then any Description.Root and ErrorMessage.Root.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Extra class on the group.',
    },
  ],
} as const satisfies ComponentMeta;
