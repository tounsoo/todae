import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Composer.Root',
  description:
    'The prompt input of a chat, as a form around a Field.Root with a Field.Textarea. Enter in a textarea of the form sends it, as the form\'s default button would; Shift+Enter, and Enter that ends an IME composition, do not. Takes native form attributes, such as onSubmit.',
  props: [
    {
      name: 'onSubmit',
      type: '(event: React.SubmitEvent<HTMLFormElement>) => void',
      required: false,
      description: "Called for this form's own submits, not those of a form rendered inside it with createPortal.",
    },
    {
      name: 'busy',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'A response is running: no submit of this form goes through, from Enter, a submit button or requestSubmit, and Composer.Submit turns into Stop. Sets data-busy.',
    },
  ],
} as const satisfies ComponentMeta;
