import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Checkbox',
  kind: 'component',
  description: 'Native checkbox. Children are the visible label. Never indeterminate.',
  whenToUse: [
    'Several independent choices that stay on the page. Children are the visible label. Never indeterminate.',
  ],
  whenNotToUse: [
    'Use Radio when one exclusive choice stays on the page.',
    'Use OptionList when the options live in a popover or sheet.',
    'Do not put Checkbox inside Field.Root.',
    'Do not wire Checkbox and OptionList to the same value.',
  ],
  intents: [
    'choose-many',
    'toggle',
  ],
  related: [
    { id: 'Radio', relation: 'alternative' },
    { id: 'OptionList', relation: 'alternative' },
    { id: 'Switch', relation: 'alternative' },
  ],
  docs: '/checkbox',
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
