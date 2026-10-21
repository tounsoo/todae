import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Decrement',
  description:
    "A button that lowers the number of the field's Field.NumberInput by its step. It is not a tab stop and keeps focus in the input, holding it repeats, and it is disabled where a step would do nothing, such as at min or while the text is no number. It is named from the decrement string of StringsProvider unless its own text names it, and draws the minus glyph of GlyphsProvider. Takes native button attributes except type.",
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Content that replaces the minus sign. Text in it names the button.',
    },
  ],
} as const satisfies ComponentMeta;
