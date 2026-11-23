import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.ItemIcon',
  description: 'Leading icon for a menu item. Order-only and aria-hidden, so the name and typeahead stay the label. No side prop.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Icon graphic.',
    },
  ],
} as const satisfies ComponentMeta;
