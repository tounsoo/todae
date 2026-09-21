import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Title',
  kind: 'part',
  description: 'Heading. Wires aria-labelledby.',
  whenToUse: [
    'Visible sheet title. Names the dialog when present.',
  ],
  whenNotToUse: [],
  intents: [
    'typography',
    'contextual-overlay',
  ],
  related: [
    { id: 'BottomSheet', relation: 'partOf' },
  ],
  docs: '/bottomsheet',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Title text.',
    },
  ],
} as const satisfies ComponentMeta;
