import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog.Header',
  kind: 'part',
  description: 'Optional header row.',
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
