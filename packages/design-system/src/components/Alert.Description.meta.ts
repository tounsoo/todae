import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Alert.Description',
  description: 'Detail under the title. A div element, so it can hold paragraphs or a list.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Body content.',
    },
  ],
} as const satisfies ComponentMeta;
