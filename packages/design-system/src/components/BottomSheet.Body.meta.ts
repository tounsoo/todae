import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Body',
  kind: 'part',
  description: 'Scroll container. Drag starts only at scrollTop 0.',
  whenToUse: [
    'Scrollable sheet body. Drag starts only at scrollTop 0.',
  ],
  whenNotToUse: [],
  intents: [
    'contextual-overlay',
  ],
  related: [
    { id: 'BottomSheet', relation: 'partOf' },
  ],
  docs: '/bottomsheet',
  props: [],
} as const satisfies ComponentMeta;
