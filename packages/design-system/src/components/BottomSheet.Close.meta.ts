import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Close',
  kind: 'part',
  description: 'Ghost Button.Root that requests close-button dismiss.',
  whenToUse: [
    'Ghost close control that requests close-button dismiss.',
  ],
  whenNotToUse: [],
  intents: [
    'action',
    'contextual-overlay',
  ],
  related: [
    { id: 'BottomSheet', relation: 'partOf' },
  ],
  docs: '/bottomsheet',
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
