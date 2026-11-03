import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Grabber',
  description: 'Drag handle. Rendered by default if omitted. A press toggles between mid and full, arrow keys step between them. A decorative mark when snapPoints has one entry.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Resize sheet"',
      description: 'Name of the resize control. Default is the resizeSheet string from StringsProvider.',
    },
  ],
} as const satisfies ComponentMeta;
