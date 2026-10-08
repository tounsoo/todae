import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Drawer.Root',
  description: 'Controlled native modal dialog pinned to the start or end edge, full height. Uses Dialog parts inside.',
  props: [
    {
      name: 'open',
      type: 'boolean',
      required: true,
      description: 'Controlled open state.',
    },
    {
      name: 'onOpenChange',
      type: '(open: boolean, reason: DialogCloseReason) => void',
      required: true,
      description: 'Dismiss requests, with the same reasons as Dialog.Root.',
    },
    {
      name: 'side',
      type: "'start' | 'end'",
      required: false,
      default: "'end'",
      description: 'Inline edge it is pinned to. Follows text direction.',
    },
    {
      name: 'dismissOnEscape',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Escape calls onOpenChange(false, "escape").',
    },
    {
      name: 'dismissOnBackdrop',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Scrim click calls onOpenChange(false, "backdrop").',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Name when Dialog.Title is omitted.',
    },
  ],
} as const satisfies ComponentMeta;
