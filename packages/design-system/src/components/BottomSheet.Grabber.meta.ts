import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Grabber',
  description: 'Drag handle. Rendered by default if omitted. Arrow keys change snap.',
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
