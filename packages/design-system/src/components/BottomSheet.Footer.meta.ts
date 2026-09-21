import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Footer',
  kind: 'part',
  description: 'Action row.',
  whenToUse: [
    'Action row at the bottom of the sheet.',
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
  props: [],
} as const satisfies ComponentMeta;
