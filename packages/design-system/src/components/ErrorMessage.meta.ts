import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ErrorMessage',
  kind: 'component',
  description:
    'Validation text below a control. Required id. No alert role. invalid lives on the control.',
  whenToUse: [
    'Validation text below a control. Required id. No alert role. invalid lives on the control.',
  ],
  whenNotToUse: [
    'Use Description for hints. Do not nest ErrorMessage inside Field.Root.',
  ],
  intents: [
    'validation-message',
  ],
  related: [
    { id: 'Description', relation: 'pairsWith' },
    { id: 'Field.Root', relation: 'pairsWith' },
  ],
  docs: '/errormessage',
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
