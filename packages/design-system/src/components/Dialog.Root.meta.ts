import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog.Root',
  description: 'Native modal dialog. Stays centered. No sheet morph.',
  props: [
    {
      name: 'open',
      type: 'boolean',
      required: false,
      description: 'Controlled open state. Leave it out for an uncontrolled dialog.',
    },
    {
      name: 'defaultOpen',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Shows the dialog on mount when uncontrolled. There is no trigger part, so once closed it opens again only on remount.',
    },
    {
      name: 'onOpenChange',
      type: '(open: boolean, reason: DialogCloseReason) => void',
      required: false,
      description:
        'Dismiss requests. When controlled, staying open keeps the dialog open. Reasons: escape, backdrop, close-button, form (a <form method="dialog"> submit; the submitter value is on the element returnValue), native (something else closed the element).',
    },
    {
      name: 'role',
      type: "'dialog' | 'alertdialog'",
      required: false,
      default: "'dialog'",
      description:
        'alertdialog marks a dialog that interrupts to ask for a response, such as confirming a destructive action. A backdrop click then no longer closes it, and on open focus goes to its first close part, such as a Dialog.Close that says Cancel. It needs a Dialog.Description or an aria-describedby for the message.',
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
      default: 'true, or false when role is alertdialog',
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
