import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Message.Actions',
  description: 'A row below the content for the message\'s actions, such as copy and retry. A div; put a Toolbar.Root in it for arrow-key focus.',
  props: [
    {
      name: 'reveal',
      type: '"always" | "hover"',
      required: false,
      default: '"always"',
      description: 'hover hides the row until the pointer is over the message or focus is inside it. On a screen with no hover, such as a phone, it always shows.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Buttons, or a Toolbar.Root holding them.',
    },
  ],
} as const satisfies ComponentMeta;
