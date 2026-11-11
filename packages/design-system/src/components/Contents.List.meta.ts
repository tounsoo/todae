import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Contents.List',
  description: 'A nested list of Contents.Item elements, for the sections under one heading. A ul; takes native ul attributes.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Contents.Item elements.',
    },
  ],
} as const satisfies ComponentMeta;
