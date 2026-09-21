import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Chip',
  kind: 'component',
  description: 'Text-only label with optional named dismiss. Overflow +N is Chip.Overflow.',
  whenToUse: [
    'Text-only token with optional named dismiss. Overflow +N is ChipOverflow.',
  ],
  whenNotToUse: [
    '+N is not a button and is not in the tab order. Do not use Chip as a filter control that owns selection.',
  ],
  intents: [
    'tag-entry',
  ],
  related: [
    { id: 'Field.ChipInput', relation: 'pairsWith' },
  ],
  docs: '/chip',
  props: [
    {
      name: 'children',
      type: 'string',
      required: true,
      description: 'Chip label. Text only.',
    },
    {
      name: 'onDismiss',
      type: '() => void',
      required: false,
      description: 'Renders a named dismiss button.',
    },
    {
      name: 'dismissLabel',
      type: 'string',
      required: false,
      description: 'Dismiss aria-label. Default is Remove {label}.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Disables dismiss.',
    },
  ],
} as const satisfies ComponentMeta;
