import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Form.Summary',
  description:
    'The problems a failed submit left, as links to their controls, or buttons for a control with no id. A failed submit moves focus to it. Renders nothing before one, or when no problem is left. Takes native div attributes.',
  props: [
    {
      name: 'title',
      type: 'React.ReactNode',
      required: false,
      description: 'Replaces the title, which is the formErrors string with the number of problems.',
    },
    {
      name: 'children',
      type: '(fields: readonly FormInvalidField[]) => React.ReactNode',
      required: false,
      description:
        'Replaces the list of links. Each field has its name, label, error and a focus() that moves focus to its control.',
    },
  ],
} as const satisfies ComponentMeta;
