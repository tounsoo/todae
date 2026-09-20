import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ErrorMessage',
  description:
    'Validation text below a control. Required id. No alert role. invalid lives on the control.',
  props: [
    {
      name: 'id',
      type: 'string',
      required: true,
      description: 'Id the author lists in aria-describedby on the control or Field.Root.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Error text.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the span.',
    },
  ],
} as const satisfies ComponentMeta;
