import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Message.Header',
  description: 'A row above the content for the author\'s name and the product\'s own time element. A div; headings and paragraphs inside lose their margin. Todae formats no dates here.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The author\'s name and, if any, a time element.',
    },
  ],
} as const satisfies ComponentMeta;
