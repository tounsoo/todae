import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Alert.Close',
  description: 'Ghost Button.Root at the end of the first row. The alert has no open state, so remove it in onClick.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Dismiss" when its text, not counting aria-hidden or SVG parts, has fewer than two letters or digits',
      description: 'Accessible name. Text of two or more letters or digits, such as "Got it", names the button by itself. Otherwise the dismiss string from StringsProvider names it, Dismiss in English.',
    },
    {
      name: 'onClick',
      type: 'React.MouseEventHandler<HTMLButtonElement>',
      required: false,
      description: 'Hide the alert here.',
    },
  ],
} as const satisfies ComponentMeta;
