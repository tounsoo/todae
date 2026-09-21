import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog.Title',
  kind: 'part',
  description: 'Heading. Wires aria-labelledby on the dialog.',
  whenToUse: [
    'Visible dialog title. Names the dialog when present.',
  ],
  whenNotToUse: [],
  intents: [
    'typography',
    'contextual-overlay',
  ],
  related: [
    { id: 'Dialog', relation: 'partOf' },
  ],
  docs: '/dialog',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Title text.',
    },
  ],
} as const satisfies ComponentMeta;
