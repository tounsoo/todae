import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog.Description',
  kind: 'part',
  description: 'Supporting text. Wires aria-describedby on the dialog.',
  whenToUse: [],
  whenNotToUse: [],
  intents: [
    'helper-text',
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
      description: 'Description text.',
    },
  ],
} as const satisfies ComponentMeta;
