import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Description',
  kind: 'part',
  description: 'Supporting text. Wires aria-describedby.',
  whenToUse: [
    'Supporting text wired as the sheet description.',
  ],
  whenNotToUse: [],
  intents: [
    'helper-text',
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
      description: 'Description text.',
    },
  ],
} as const satisfies ComponentMeta;
