import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ButtonGroup',
  kind: 'component',
  description: 'Chrome-only attached row of Button.Root. role=group. No selection state.',
  whenToUse: [
    'Attached row of Button.Root. role=group. Chrome only.',
  ],
  whenNotToUse: [
    'No selection state. Use RadioGroup or OptionList to choose.',
  ],
  intents: [
    'layout',
    'action',
  ],
  slots: [
    { name: 'children', accepts: [
      'Button.Root',
    ], required: true, description: 'Button.Root children. Horizontal only.' },
  ],
  related: [
    { id: 'Button.Root', relation: 'requires' },
  ],
  docs: '/button',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Accessible name for the group.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Button.Root children. Horizontal only.',
    },
  ],
} as const satisfies ComponentMeta;
