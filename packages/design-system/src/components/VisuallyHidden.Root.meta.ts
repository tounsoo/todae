import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'VisuallyHidden.Root',
  description: 'Hides content on screen and keeps it for assistive technology. A span with no role; takes native span attributes.',
  props: [
    {
      name: 'focusable',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Shows the content again while focus is on it or inside it, for a skip link.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Text for assistive technology, or a focusable element such as a skip link.',
    },
  ],
} as const satisfies ComponentMeta;
