import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog.Body',
  kind: 'part',
  description: 'Scrollable body.',
  whenToUse: [],
  whenNotToUse: [],
  intents: [
    'contextual-overlay',
  ],
  related: [
    { id: 'Dialog', relation: 'partOf' },
  ],
  docs: '/dialog',
  props: [],
} as const satisfies ComponentMeta;
