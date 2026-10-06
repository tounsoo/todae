import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.CheckboxItem',
  description:
    'role="menuitemcheckbox". Toggles aria-checked; stays open by default.',
  props: [
    {
      name: 'checked',
      type: 'boolean',
      required: false,
      description: 'Controlled checked state.',
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
      description: 'Fires with the next checked state.',
    },
    {
      name: 'closeOnSelect',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Close the menu after toggling.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      description: 'aria-disabled. Skipped by arrow keys.',
    },
    {
      name: 'textValue',
      type: 'string',
      required: false,
      description: 'Typeahead text when children are not plain text.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Item label.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class.',
    },
  ],
} as const satisfies ComponentMeta;
