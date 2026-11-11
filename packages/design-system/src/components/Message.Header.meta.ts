import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Message.Header',
  description: 'A row above the content for the author\'s name and a Message.Time. A div; headings and paragraphs directly inside lose their margin.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The author\'s name and, if any, a Message.Time.',
    },
  ],
} as const satisfies ComponentMeta;
