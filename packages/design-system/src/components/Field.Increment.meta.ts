import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Increment',
  description:
    "A button that raises the number of the field's Field.NumberInput by its step. It is not a tab stop and keeps focus in the input, holding it repeats, and it is disabled where a step would do nothing, such as at max or while the text is no number. It is named from the increment string of StringsProvider unless its own text names it, and draws the plus glyph of GlyphsProvider. Takes native button attributes except type.",
  props: [
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Content that replaces the plus sign. Text in it names the button.',
    },
  ],
} as const satisfies ComponentMeta;
