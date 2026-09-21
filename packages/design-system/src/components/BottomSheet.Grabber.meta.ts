import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Grabber',
  kind: 'part',
  description: 'Drag handle. Rendered by default if omitted. Arrow keys change snap.',
  whenToUse: [
    'Drag handle. Rendered by default if omitted. Arrow keys change snap.',
  ],
  whenNotToUse: [],
  intents: [
    'contextual-overlay',
  ],
  related: [
    { id: 'BottomSheet', relation: 'partOf' },
  ],
  docs: '/bottomsheet',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Resize sheet"',
      description: 'Name of the resize control.',
    },
  ],
} as const satisfies ComponentMeta;
