import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog.Footer',
  kind: 'part',
  description: 'Action row.',
  whenToUse: [
    'Action row for confirm and cancel.',
  ],
  whenNotToUse: [],
  intents: [
    'action',
    'contextual-overlay',
  ],
  related: [
    { id: 'Dialog', relation: 'partOf' },
  ],
  docs: '/dialog',
  props: [],
} as const satisfies ComponentMeta;
