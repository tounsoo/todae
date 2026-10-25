import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Text.Root',
  description: 'Text and headings styled through the text contract tokens.',
  props: [
    {
      name: 'as',
      type: '"p" | "span" | "strong" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"',
      required: false,
      default: '"p"',
      description: 'Rendered element. A heading level sets the outline and picks that level\'s scale, bold weight and tight leading: h1 text.size.6, h2 text.size.5, h3 text.size.4, h4 and h5 text.size.3, h6 text.size.2. With no heading, the scale is text.size.3.',
    },
    {
      name: 'variant',
      type: '"label"',
      required: false,
      description: 'The label role for eyebrows, kickers and metadata. It reads text.label.* for its family, size, weight, leading, letter spacing, case and color, and sets font-family, from text.font.family by default. A tone or weight you give wins.',
    },
    {
      name: 'tone',
      type: '"default" | "muted" | "accent"',
      required: false,
      default: '"default"; text.label.fg with variant "label"',
      description: 'Foreground role. accent follows color.accent.default, which is neutral ink in Todae, so it matches default until a theme sets a brand accent.',
    },
    {
      name: 'weight',
      type: '"regular" | "medium" | "bold"',
      required: false,
      default: '"regular"; "bold" for headings; text.label.font.weight with variant "label"',
      description: 'Font weight.',
    },
    {
      name: 'lines',
      type: 'number',
      required: false,
      description: 'Clamps the text to this many lines, a whole number of 1 or more, with an ellipsis at the end of the last line. The element becomes a block. Screen readers still read the whole text.',
    },
    {
      name: 'tooltip',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'With lines, shows the whole text in a tooltip on hover, or on keyboard focus of the text or a link, row or menu item around it, when the text is cut. The tooltip is hidden from screen readers. The @tounsoo/todae/text entry draws no tooltip.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Text content.',
    },
  ],
} as const satisfies ComponentMeta;
