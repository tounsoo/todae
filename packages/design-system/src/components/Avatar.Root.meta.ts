import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Avatar.Root',
  description:
    'A span that shows an image, or a fallback while it loads, when it fails or when there is none. Named by label as one image (role="img"); without label it is hidden from assistive technology. Takes native span attributes.',
  props: [
    {
      name: 'label',
      type: 'string',
      required: false,
      description: 'Names the avatar, whichever of the image and the fallback shows. Leave it out when the name is written next to the avatar.',
    },
    {
      name: 'size',
      type: '"sm" | "md" | "lg"',
      required: false,
      default: '"md"',
      description: 'Size from the avatar.size contract tokens.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Avatar.Image and Avatar.Fallback.',
    },
  ],
} as const satisfies ComponentMeta;
