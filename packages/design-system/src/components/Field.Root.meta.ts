import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Root',
  description:
    'Field compound scope. Context plus vertical stack. Label sits above the bordered control shell; inputs and adornments sit inside it. No value.',
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
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description:
        'Optional Label, then TextInput or ChipInput plus optional Icon/Affix. Order is leading/trailing inside the shell. Label must be a direct child of Root.',
    },
  ],
} as const satisfies ComponentMeta;
