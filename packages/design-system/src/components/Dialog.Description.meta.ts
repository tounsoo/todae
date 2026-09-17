import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Dialog.Description',
  description: 'Supporting text. Wires aria-describedby on the dialog.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Description text.',
    },
  ],
} as const satisfies ComponentMeta;
