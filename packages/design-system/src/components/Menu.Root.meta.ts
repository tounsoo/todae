import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Menu.Root',
  description:
    'Owns open state for one action menu. Renders no element.',
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
      type: '(open: boolean, reason: MenuOpenChangeReason) => void',
      required: false,
      description: 'Fires on open and close. reason is trigger, escape, outside, select or tab. Leaving open unchanged is a veto.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Menu.Trigger and Menu.Content.',
    },
  ],
} as const satisfies ComponentMeta;
