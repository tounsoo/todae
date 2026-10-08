import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Avatar.Image',
  description:
    'An img that shows once it has loaded and covers the fallback. Its alt is always empty, because Avatar.Root carries the name. Takes native img attributes except alt.',
  props: [
    {
      name: 'src',
      type: 'string',
      required: false,
      description: 'The image. Without one, or when it fails to load, the fallback stays.',
    },
  ],
} as const satisfies ComponentMeta;
