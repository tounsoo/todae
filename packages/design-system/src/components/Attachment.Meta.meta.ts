import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Attachment.Meta',
  description: "A line under the name, such as the file's size and type, or what went wrong. Takes native span attributes.",
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Size, type, or an error.',
    },
  ],
} as const satisfies ComponentMeta;
