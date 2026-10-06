import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.Item',
  description:
    'role="menuitem". Enter, Space or a click runs onSelect and closes the menu.',
  props: [
    {
      name: 'onSelect',
      type: '() => void',
      required: false,
      description: 'Runs when the item is chosen.',
    },
    {
      name: 'closeOnSelect',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Close the menu after choosing.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      description: 'aria-disabled. Skipped by arrow keys and ignores choosing.',
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
