import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'TextField',
  description: 'Compound text field. One focus ring on the shared shell.',
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
      description: 'Input and optional IconStart, IconEnd, Prefix, Suffix.',
    },
  ],
} as const satisfies ComponentMeta;
