import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Attachment.Name',
  description:
    'The file name, cut with an ellipsis when it is too long. It names the group, Attachment.Progress and Attachment.Remove. Takes native span attributes.',
  props: [
    {
      name: 'children',
      type: 'string',
      required: true,
      description: 'The file name. Text only.',
    },
  ],
} as const satisfies ComponentMeta;
