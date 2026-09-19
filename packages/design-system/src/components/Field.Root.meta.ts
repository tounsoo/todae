import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Root',
  description: 'Field chrome only. No value. Children render in source order.',
  props: [
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Disables the input and marks the shell.',
    },
    {
      name: 'invalid',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Marks the shell invalid and sets aria-invalid on the input.',
    },
    {
      name: 'id',
      type: 'string',
      required: false,
      description: 'Input id. Auto-generated when omitted.',
    },
    {
      name: 'name',
      type: 'string',
      required: false,
      description: 'Native input name.',
    },
    {
      name: 'ref',
      type: 'Ref<HTMLDivElement>',
      required: false,
      description: 'Shell element. Use as a Popover anchorRef.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'TextInput or ChipInput plus optional Icon and Affix. Order is leading/trailing.',
    },
  ],
} as const satisfies ComponentMeta;
