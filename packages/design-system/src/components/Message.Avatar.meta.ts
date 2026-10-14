import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Message.Avatar',
  description: 'A slot beside the message for an Avatar.Root. A div; with one, the other parts sit in a column next to it, after it for a user\'s message.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'An Avatar.Root.',
    },
  ],
} as const satisfies ComponentMeta;
