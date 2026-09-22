import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Affix',
  kind: 'part',
  description: 'Order-only text adornment. Not clickable. No side prop.',
  whenToUse: [],
  whenNotToUse: [],
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
