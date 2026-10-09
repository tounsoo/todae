import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Avatar.Fallback',
  description: 'Shows until the image loads, and stays when it fails or there is none. Takes native span attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Initials or an icon.',
    },
  ],
} as const satisfies ComponentMeta;
