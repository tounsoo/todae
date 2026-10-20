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
      description: 'aria-disabled. Stays in the arrow-key order, so it is announced, but cannot be chosen.',
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
    {
      name: 'render',
      type: '(props: MenuItemRenderProps) => React.ReactElement',
      required: false,
      description:
        'Renders the item on another element, such as an a or a router link that goes somewhere when chosen. It receives every prop, ref included, and must pass them on.',
    },
  ],
} as const satisfies ComponentMeta;
