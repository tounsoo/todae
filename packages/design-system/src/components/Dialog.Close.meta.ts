import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog.Close',
  description: 'Ghost Button.Root that requests close-button dismiss.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Close" when the button has no text of its own',
      description: 'Accessible name. Visible text such as "Cancel" names the button by itself. The default is English, so pass a name in your app\'s language.',
    },
  ],
} as const satisfies ComponentMeta;
