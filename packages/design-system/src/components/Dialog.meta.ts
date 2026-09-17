import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog',
  description: 'Controlled native modal dialog. Stays centered. No sheet morph.',
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
      description: 'Dismiss requests. Staying open keeps the dialog open.',
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
