import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Conversation.Viewport',
  description:
    'The scroller, a section that is a region landmark named by the conversation string unless it has aria-label or aria-labelledby. It opens at the end, follows it while the content grows, and stops following when the reader scrolls up. It takes a Tab stop while it overflows and nothing inside can take focus. Takes native section attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Conversation.Content.',
    },
  ],
} as const satisfies ComponentMeta;
