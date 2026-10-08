import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Avatar.Image',
  description:
    'An img drawn over the fallback, which is removed once the image loads and stays when it fails. Its alt is always empty, because Avatar.Root carries the name. Takes native img attributes except alt.',
  props: [
    {
      name: 'src',
      type: 'string',
      required: false,
      description: 'The image, or srcSet in its place. Without either, or when it fails to load, the fallback stays.',
    },
  ],
} as const satisfies ComponentMeta;
