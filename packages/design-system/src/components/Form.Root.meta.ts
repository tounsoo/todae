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
        'Problems you found, such as a server reply, keyed by a control name. Todae never writes it: clear it when you send, in onSubmit, and set it when the reply comes. Entries show at once in place of the control\'s native problem and do not block a submit. An edit to a control hides its entry until the next submit, or until errors drops that name or changes its text. After a send, a reply is a commit whose content differs from the commit before and has entries (clear-then-set counts, a rebuild of the same content does not); it moves focus to the summary or the first enabled control with a server error and lists only server errors.',
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
      description: 'Runs on this form\'s reset, not a portaled form\'s, as onSubmit does. A reset hides every shown problem again.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'The controls, usually in Field.Group and Fieldset.Root, and an optional Form.Summary.',
    },
  ],
} as const satisfies ComponentMeta;
