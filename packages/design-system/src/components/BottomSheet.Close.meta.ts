import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'BottomSheet.Close',
  description: 'Ghost Button.Root that requests close-button dismiss.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Close" when its text, not counting aria-hidden or SVG parts, has fewer than two letters or digits',
      description: 'Accessible name. Text of two or more letters or digits, such as "Cancel", names the button by itself. Otherwise the close string from StringsProvider names it, Close in English.',
    },
  ],
} as const satisfies ComponentMeta;
