import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Fieldset.Root',
  description: 'A native fieldset that groups related controls, such as a set of checkboxes, under one Legend. Takes native fieldset attributes. Inside a Form.Root it is a validation scope: its controls\' native problems show in an ErrorMessage.Root with no id.',
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
      description: 'Marks the Todae controls inside invalid (aria-invalid and the invalid style); a control with invalid={false} opts out. A fieldset has no aria-invalid of its own, so point aria-describedby at an ErrorMessage.',
    },
    {
      name: 'customValidity',
      type: 'string',
      required: false,
      description:
        "A message for a rule the browser cannot check, set with setCustomValidity on the fieldset's own first control that takes part in validation; when all its controls sit in nested groups, on the first one at any depth, where its error shows. An empty string or undefined means the rule holds. Warns in development when there is no such control.",
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
