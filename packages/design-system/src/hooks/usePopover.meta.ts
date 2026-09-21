import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'usePopover',
  description:
    'One open machine. Spread getTriggerProps onto the trigger and getPopoverProps onto Popover.',
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
      type: '(open: boolean, reason: PopoverCloseReason) => void',
      required: false,
      description: 'Fires on toggle or dismiss. Leaving open unchanged is a veto.',
    },
    {
      name: 'anchorRef',
      type: 'RefObject<HTMLElement | null>',
      required: false,
      description: 'Sets CSS anchor-name on this element and excludes it from outside press.',
    },
    {
      name: 'initialFocusRef',
      type: 'RefObject<HTMLElement | null>',
      required: false,
      description: 'Focus this element when the popover opens.',
    },
    {
      name: 'restoreFocusRef',
      type: 'RefObject<HTMLElement | null>',
      required: false,
      description: 'Return focus here when the popover closes.',
    },
    {
      name: 'enabled',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'False skips toggle, dismiss, and focus moves.',
    },
    {
      name: 'id',
      type: 'string',
      required: false,
      description: 'Popover id. Default is a generated id.',
    },
  ],
} as const satisfies ComponentMeta;
