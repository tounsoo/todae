import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Form.Root',
  description:
    'A native form that checks its controls before it submits and shows each problem in a Field.Group or Fieldset.Root. Sets noValidate. Takes native form attributes.',
  props: [
    {
      name: 'errors',
      type: 'Readonly<Record<string, string>>',
      required: false,
      description:
        'Problems you found, such as a server reply, keyed by a control name. They show at once in place of the control\'s native problem and do not block a submit. An edit to a control hides its entry until the next submit or until its text for that name changes.',
    },
    {
      name: 'onSubmit',
      type: 'React.FormEventHandler<HTMLFormElement>',
      required: false,
      description:
        'Runs for a submit with every control valid, or one sent by a submit button with formNoValidate, which is a send without the check that reveals nothing new. Form.Root checks first, and a submit with a problem does not reach it.',
    },
    {
      name: 'onReset',
      type: 'React.FormEventHandler<HTMLFormElement>',
      required: false,
      description: 'Runs on reset. A reset hides every shown problem again.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The controls, usually in Field.Group and Fieldset.Root, and an optional Form.Summary.',
    },
  ],
} as const satisfies ComponentMeta;
