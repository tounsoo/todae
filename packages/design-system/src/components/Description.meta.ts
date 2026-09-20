import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Description',
  description:
    'Supporting text below a control. Required id. Sibling, not a Field part. Author wires aria-describedby.',
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
      description: 'Hint text.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the span.',
    },
  ],
} as const satisfies ComponentMeta;
