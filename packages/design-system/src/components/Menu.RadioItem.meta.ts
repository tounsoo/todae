import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.RadioItem',
  description:
    'role="menuitemradio" in a Menu.RadioGroup. Stays open by default.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'Value this item sets on its group.',
    },
    {
      name: 'closeOnSelect',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Close the menu after choosing.',
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
