import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Chip.Root',
  description: 'Text-only label with optional named dismiss. Overflow +N is Chip.Overflow.',
  props: [
    {
      name: 'children',
      type: 'string',
      required: true,
      description: 'Chip label. Text only.',
    },
    {
      name: 'onRemove',
      type: '() => void',
      required: false,
      description: 'Renders a named dismiss button.',
    },
    {
      name: 'removeLabel',
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
