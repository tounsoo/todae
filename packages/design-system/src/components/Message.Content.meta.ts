import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Message.Content',
  description: 'The message body. A div; for a user\'s message it is the bubble.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The text, often a Prose.Root with rendered markdown.',
    },
  ],
} as const satisfies ComponentMeta;
