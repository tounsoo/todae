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
      name: 'customValidity',
      type: 'string',
      required: false,
      description:
        "A message for a rule the browser cannot check, set with setCustomValidity on the field's control when that is a native input, select or textarea. An empty string or undefined means the rule holds.",
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
        'Ids of Description and ErrorMessage. Put this on Root. Input parts add their own ids after these.',
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
