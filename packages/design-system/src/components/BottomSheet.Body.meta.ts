import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Body',
  kind: 'part',
  description: 'Scroll container. Drag starts only at scrollTop 0.',
  whenToUse: [],
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
