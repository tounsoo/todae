import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Header',
  kind: 'part',
  description: 'Chrome. Drag-eligible.',
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
