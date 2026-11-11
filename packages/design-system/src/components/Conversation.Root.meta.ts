import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Conversation.Root',
  description:
    'A conversation of messages that keeps the newest one in view while it grows. It follows the end until the reader scrolls up, and Conversation.ScrollButton brings them back. Give it a height. Takes native div attributes.',
  props: [
    {
      name: 'announceMessages',
      type: 'boolean',
      required: false,
      default: 'true',
      description:
        'Whether it tells screen readers when a message starts and finishes arriving, read from aria-busy on the articles in Conversation.Content. The text is the messageStarted and messageFinished strings.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Conversation.Viewport and Conversation.ScrollButton.',
    },
  ],
} as const satisfies ComponentMeta;
