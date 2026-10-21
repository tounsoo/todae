import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Checkbox.Root',
  description: 'Native checkbox. Children are the visible label.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: true,
      description: 'Visible label. Clicking the text toggles the input.',
    },
    {
      name: 'checked',
      type: 'boolean',
      required: false,
      description: 'Controlled checked state. Defined means controlled.',
    },
    {
      name: 'defaultChecked',
      type: 'boolean',
      required: false,
      description: 'Initial checked state when uncontrolled.',
    },
    {
      name: 'onCheckedChange',
      type: '(checked: boolean) => void',
      required: false,
      description: 'Fires after the checked state changes.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      description: 'Disables the input.',
    },
    {
      name: 'invalid',
      type: 'boolean',
      required: false,
      description: 'Marks the control invalid and sets aria-invalid.',
    },
    {
      name: 'indeterminate',
      type: 'boolean',
      required: false,
      description: 'The mixed state, such as a select-all box over a partly selected list. Sets the input\'s indeterminate and shows the indeterminate glyph in place of the check. A click still toggles checked.',
    },
    {
      name: 'name',
      type: 'string',
      required: false,
      description: 'Native input name.',
    },
    {
      name: 'value',
      type: 'string',
      required: false,
      description: 'Native input value.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the wrapping label.',
    },
  ],
} as const satisfies ComponentMeta;
