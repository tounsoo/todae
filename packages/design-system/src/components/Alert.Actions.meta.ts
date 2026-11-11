import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Alert.Actions',
  description: 'A wrapping row of buttons or links under the text.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Buttons or links.',
    },
  ],
} as const satisfies ComponentMeta;
