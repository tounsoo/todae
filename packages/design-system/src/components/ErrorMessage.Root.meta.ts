import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'ErrorMessage.Root',
  description:
    "Validation text below a control. With an id it renders as given, with no alert role. Without one, inside a Field.Group or Fieldset.Root in a Form.Root, it shows the scope's error and wires the controls' aria-describedby to itself. invalid lives on the control.",
  props: [
    {
      name: 'id',
      type: 'string',
      required: false,
      description:
        "Id the author lists in aria-describedby on the control or Field.Root. Required outside a validation scope; inside one, leave it out to take the scope's error.",
    },
    {
      name: 'children',
      type: 'React.ReactNode | ((error: FormFieldError) => React.ReactNode)',
      required: false,
      description:
        "Error text. Without an id, in a validation scope, a function of the scope's error is allowed too, and no children shows the error's message.",
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the span.',
    },
  ],
} as const satisfies ComponentMeta;
