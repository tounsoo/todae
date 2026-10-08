import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Toolbar.Group',
  description: 'role="group" around controls that belong together. Takes native div attributes.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Names the group, such as "Text style".',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Controls in the group.',
    },
  ],
} as const satisfies ComponentMeta;
