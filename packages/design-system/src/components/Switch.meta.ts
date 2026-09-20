import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Switch',
  description: 'On or off. Track and thumb. Children are the visible label. No check glyph.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: true,
      description: 'Visible label. Clicking the text toggles the switch.',
    },
    {
      name: 'checked',
      type: 'boolean',
      required: false,
      description: 'Controlled on state. Defined means controlled.',
    },
    {
      name: 'defaultChecked',
      type: 'boolean',
      required: false,
      description: 'Initial on state when uncontrolled.',
    },
    {
      name: 'onCheckedChange',
      type: '(checked: boolean) => void',
      required: false,
      description: 'Fires after the on state changes.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      description: 'Disables the switch.',
    },
    {
      name: 'invalid',
      type: 'boolean',
      required: false,
      description: 'Marks the control invalid and sets aria-invalid.',
    },
    {
      name: 'name',
      type: 'string',
      required: false,
      description: 'Native input name.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the wrapping label.',
    },
  ],
} as const satisfies ComponentMeta;
