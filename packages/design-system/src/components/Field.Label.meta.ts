import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Label',
  description: 'Visible label. Auto-wires htmlFor to the field input. Not a control.',
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Label text. A required mark is authored here when needed.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the native label.',
    },
  ],
} as const satisfies ComponentMeta;
