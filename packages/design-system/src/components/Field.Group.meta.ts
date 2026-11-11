import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Group',
  description:
    'Column that stacks a Label.Root or caption, the control, then Description.Root and ErrorMessage.Root. The label or caption sits field.label.gap above the control; the messages keep the distances they have outside a group. Renders a div outside Field.Root. Inside a Form.Root it is a validation scope: its controls\' native problems show in an ErrorMessage.Root with no id.',
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
