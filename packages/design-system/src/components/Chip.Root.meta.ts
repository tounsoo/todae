import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Chip.Root',
  description: 'Text-only label with optional named remove button. Overflow +N is Chip.Overflow.',
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
      description: 'Renders a named remove button.',
    },
    {
      name: 'removeLabel',
      type: 'string',
      required: false,
      description: 'Remove button aria-label. Default is Remove {label}.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Disables the remove button.',
    },
  ],
} as const satisfies ComponentMeta;
