import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Attachment.Remove',
  description: 'A ghost Button.Root that removes the file. Takes Button.Root props but pressed.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: "The button's content. Without it, the close glyph, named by the removeAttachment string, Remove {name} in English.",
    },
  ],
} as const satisfies ComponentMeta;
