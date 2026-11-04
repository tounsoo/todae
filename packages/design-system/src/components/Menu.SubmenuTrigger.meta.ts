import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.SubmenuTrigger',
  description:
    'role="menuitem" with aria-haspopup="menu" and a chevron toward the line end. Right arrow (left in RTL), Enter or Space opens the submenu and focuses its first item. The pointer resting on it opens it after menu.submenu.delay.show; a click opens it.',
  props: [
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      description: 'aria-disabled. Stays in the arrow-key order, so it is announced, but cannot open.',
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
      description: 'Item label. It also names the submenu.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class.',
    },
  ],
} as const satisfies ComponentMeta;
