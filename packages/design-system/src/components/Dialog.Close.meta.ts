import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog.Close',
  description: 'Ghost Button.Root that requests close-button dismiss.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Close" when its spoken text has fewer than two letters or digits',
      description: 'Accessible name. Visible text of two or more letters or digits, such as "Cancel", names the button by itself. The default is English, so pass a name in your app\'s language.',
    },
  ],
} as const satisfies ComponentMeta;
