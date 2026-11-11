import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Coachmark.Description',
  description: 'Text.Root paragraph. Wires aria-describedby on the popup.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'What the highlighted element does, or what to do with it.',
    },
  ],
} as const satisfies ComponentMeta;
