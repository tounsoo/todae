import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Label.Root',
  description: 'Visible name for a control. Sibling, not a Field part. Pass htmlFor the control id.',
  props: [
    {
      name: 'htmlFor',
      type: 'string',
      required: true,
      description: 'Id of the labelled control. Must match Field.Root id when captioning a Field.',
    },
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
