import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Fieldset.Root',
  description: 'A native fieldset that groups related controls, such as a set of checkboxes, under one Legend. Takes native fieldset attributes.',
  props: [
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Native disabled: every form control inside is disabled. Todae controls inside also show their disabled style.',
    },
    {
      name: 'invalid',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Marks the Todae controls inside invalid (aria-invalid and the invalid style). A fieldset has no aria-invalid of its own, so point aria-describedby at an ErrorMessage.',
    },
    {
      name: 'aria-describedby',
      type: 'string',
      required: false,
      description: 'Ids of a Description or ErrorMessage for the whole group.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'A Fieldset.Legend first, then the controls.',
    },
  ],
} as const satisfies ComponentMeta;
