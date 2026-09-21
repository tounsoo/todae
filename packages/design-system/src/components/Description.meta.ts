import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Description',
  kind: 'component',
  description:
    'Supporting text below a control. Required id. Sibling, not a Field part. Author wires aria-describedby.',
  whenToUse: [
    'Supporting hint below a control. Required id. Sibling, not a Field part. Author wires aria-describedby.',
  ],
  whenNotToUse: [
    'Use ErrorMessage for validation text. Do not nest Description inside Field.Root.',
  ],
  intents: [
    'helper-text',
  ],
  related: [
    { id: 'ErrorMessage', relation: 'pairsWith' },
    { id: 'Field.Root', relation: 'pairsWith' },
    { id: 'Label', relation: 'pairsWith' },
  ],
  docs: '/description',
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
