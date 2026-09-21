import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog',
  kind: 'component',
  description: 'Controlled native modal dialog. Stays centered. No sheet morph.',
  whenToUse: [
    'Centered native modal dialog. Controlled open. Escape and backdrop dismiss are opt-out.',
    'Use Dialog for a modal confirm that stays on screen.',
  ],
  whenNotToUse: [
    'Use BottomSheet for a mobile sheet. No sheet morph.',
  ],
  intents: [
    'confirm',
    'destructive-confirm',
    'contextual-overlay',
  ],
  slots: [
    { name: 'children', accepts: [
      'Dialog.Header',
      'Dialog.Title',
      'Dialog.Description',
      'Dialog.Body',
      'Dialog.Footer',
      'Dialog.Close',
    ], required: false, description: 'Dialog parts.' },
  ],
  related: [
    { id: 'BottomSheet', relation: 'alternative' },
  ],
  docs: '/dialog',
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
