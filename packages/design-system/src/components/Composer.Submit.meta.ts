import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Composer.Submit',
  description:
    "A Button.Root that sends the form, at the end of a Field.Row. While the composer is busy it is a Stop button instead. Takes Button.Root props but pressed.",
  props: [
    {
      name: 'onStop',
      type: '() => void',
      required: false,
      description: 'Called when Stop is pressed. Without it, Stop is disabled while the composer is busy.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      description: 'Disables Send, such as while nothing is typed. Stop ignores it.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: "The button's content. Without it, the send glyph named by the send string, or the stop glyph named by the stop string while busy.",
    },
  ],
} as const satisfies ComponentMeta;
