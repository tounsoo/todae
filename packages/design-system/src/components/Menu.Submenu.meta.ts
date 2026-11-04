import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.Submenu',
  description:
    'Owns open state for one submenu inside Menu.Content or another submenu. Renders no element. It closes when the menu it sits in closes or focus moves to another of its items.',
  props: [
    {
      name: 'open',
      type: 'boolean',
      required: false,
      description: 'Controlled open state.',
    },
    {
      name: 'defaultOpen',
      type: 'boolean',
      required: false,
      description: 'Initial open state when uncontrolled.',
    },
    {
      name: 'onOpenChange',
      type: '(open: boolean, reason: MenuSubmenuOpenChangeReason) => void',
      required: false,
      description:
        'Fires on open and close. reason is trigger, pointer, escape, arrow or parent. Leaving open unchanged is a veto.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'One Menu.SubmenuTrigger and one Menu.SubmenuContent.',
    },
  ],
} as const satisfies ComponentMeta;
