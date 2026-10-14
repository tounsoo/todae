import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Conversation.ScrollButton',
  description:
    'A Button.Root over the end of the viewport that scrolls to the newest message, hidden while the reader is at the end. Takes Button.Root props but pressed.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: "The button's content. Without it, the chevron glyph, named by the scrollToLatest string.",
    },
  ],
} as const satisfies ComponentMeta;
