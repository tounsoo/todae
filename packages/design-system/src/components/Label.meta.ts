import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Label',
  kind: 'component',
  description: 'Visible name for a control. Sibling, not a Field part. Pass htmlFor the control id.',
  whenToUse: [
    'Visible name for a control. Sibling, not a Field part. htmlFor must match the control id.',
  ],
  whenNotToUse: [
    'A role=radiogroup is not labelable. Caption RadioGroup with Text and aria-labelledby.',
    'Do not nest Label inside Field.Root.',
  ],
  intents: [
    'label',
  ],
  related: [
    { id: 'Field.Root', relation: 'pairsWith' },
  ],
  docs: '/label',
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
