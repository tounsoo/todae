import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Drawer.Close',
  description: 'Ghost Button.Root that requests close-button dismiss.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Close" when its text, not counting aria-hidden or SVG parts, has fewer than two letters or digits',
      description: 'Accessible name. Text of two or more letters or digits, such as "Cancel", names the button by itself. Otherwise the close string from StringsProvider names it, Close in English.',
    },
    {
      name: 'onClick',
      type: 'React.MouseEventHandler<HTMLButtonElement>',
      required: false,
      description: 'Runs before the close request. Call event.preventDefault() to keep the drawer open.',
    },
  ],
} as const satisfies ComponentMeta;
