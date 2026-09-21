import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog.Header',
  kind: 'part',
  description: 'Optional header row.',
  whenToUse: [
    'Title row for the dialog.',
  ],
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
