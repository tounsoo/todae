import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Composer.Root',
  description:
    'The prompt input of a chat, as a form around a Field.Root with a Field.Textarea. Enter in a textarea of the form sends it, as the form\'s default button would; Shift+Enter, and Enter that ends an IME composition, do not. Takes native form attributes, such as onSubmit.',
  props: [
    {
      name: 'busy',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'A response is running: Enter sends nothing, and Composer.Submit turns into Stop. Sets data-busy.',
    },
  ],
} as const satisfies ComponentMeta;
