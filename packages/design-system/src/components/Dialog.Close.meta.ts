import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog.Close',
  kind: 'part',
  description: 'Ghost Button.Root that requests close-button dismiss.',
  whenToUse: [],
  whenNotToUse: [],
  intents: [
    'action',
    'contextual-overlay',
  ],
  related: [
    { id: 'Dialog', relation: 'partOf' },
  ],
  docs: '/dialog',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Close"',
      description: 'Accessible name.',
    },
  ],
} as const satisfies ComponentMeta;
