import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Button.Icon',
  kind: 'part',
  description: 'Order-only decorative icon. Always aria-hidden. No side prop.',
  whenToUse: [],
  whenNotToUse: [],
  intents: [
    'action',
  ],
  related: [
    { id: 'Button.Root', relation: 'partOf' },
  ],
  docs: '/button',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Icon graphic.',
    },
  ],
} as const satisfies ComponentMeta;
