import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Root',
  kind: 'component',
  description: 'Field chrome only. No value. Children render in source order.',
  whenToUse: [
    'Field chrome only. No value. Children render in source order. Label is a sibling.',
  ],
  whenNotToUse: [
    'Field shell is not a button. Do not put role=button on Field.Root that also hosts TextInput.',
    'Do not nest Checkbox or Radio inside Field.Root.',
  ],
  intents: [
    'text-entry',
    'tag-entry',
  ],
  slots: [
    { name: 'children', accepts: [
      'Field.TextInput',
      'Field.ChipInput',
      'Field.Icon',
      'Field.Affix',
    ], required: true, description: 'One input plus optional Icon and Affix. Order is leading or trailing.' },
  ],
  related: [
    { id: 'Label', relation: 'pairsWith' },
    { id: 'Description', relation: 'pairsWith' },
    { id: 'ErrorMessage', relation: 'pairsWith' },
  ],
  docs: '/field',
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
      name: 'aria-describedby',
      type: 'string',
      required: false,
      description:
        'Ids of Description and ErrorMessage. Put this on Root. TextInput overwrites input-level aria.',
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
