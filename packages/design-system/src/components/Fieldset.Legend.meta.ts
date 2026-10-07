import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Fieldset.Legend',
  description: 'The native legend that names the group. Render it as the first child of Fieldset.Root.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Group name.',
    },
  ],
} as const satisfies ComponentMeta;
