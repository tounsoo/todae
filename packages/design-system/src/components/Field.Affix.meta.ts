import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Affix',
  kind: 'part',
  description: 'Order-only text adornment. Not clickable. No side prop.',
  whenToUse: [
    'Order-only text adornment inside Field.Root. Not clickable. No side prop.',
  ],
  whenNotToUse: [
    'Not a free-floating atom. Product trees import Field.Affix, not a raw Affix.',
  ],
  intents: [
    'text-entry',
  ],
  related: [
    { id: 'Field.Root', relation: 'partOf' },
  ],
  docs: '/field',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Affix content. Strings render as text.',
    },
  ],
} as const satisfies ComponentMeta;
