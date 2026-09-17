import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Popover',
  description: 'Non-modal popover="manual". Controlled open. hidePopover only when open is false.',
  props: [
    {
      name: 'open',
      type: 'boolean',
      required: true,
      description: 'Controlled open state.',
    },
    {
      name: 'onOpenChange',
      type: '(open: boolean, reason: PopoverCloseReason) => void',
      required: true,
      description: 'Dismiss or trigger requests. Staying open keeps the popover open.',
    },
    {
      name: 'anchorRef',
      type: 'RefObject<HTMLElement | null>',
      required: false,
      description: 'Positioning target when Popover.Trigger is omitted.',
    },
  ],
} as const satisfies ComponentMeta;
