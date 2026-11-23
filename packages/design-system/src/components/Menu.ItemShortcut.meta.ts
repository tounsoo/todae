import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.ItemShortcut',
  description:
    'Trailing shortcut for a menu item, such as a Kbd. Order-only and aria-hidden, so the name and typeahead stay the label. Put aria-keyshortcuts on the item. No side prop.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The shortcut, such as nested Kbd.Root elements.',
    },
  ],
} as const satisfies ComponentMeta;
