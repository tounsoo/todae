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
      description: 'Rendered element. A heading level sets the outline; it also picks a default size, bold weight and tight leading.',
    },
    {
      name: 'size',
      type: '"s" | "m" | "l" | "xl" | "2xl"',
      required: false,
      default: '"m"; for headings h1 "2xl", h2 "xl", h3 "l", h4 and h5 "m", h6 "s"',
      description: 'Maps to text.size.2 through text.size.6. Set it to make a heading look larger or smaller than its level.',
    },
    {
      name: 'tone',
      type: '"default" | "muted" | "accent"',
      required: false,
      default: '"default"',
      description: 'Foreground role. accent follows color.accent.default, which is neutral ink in Todae, so it matches default until a theme sets a brand accent.',
    },
    {
      name: 'weight',
      type: '"regular" | "medium" | "bold"',
      required: false,
      default: '"regular"; "bold" for headings',
      description: 'Font weight.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Text content.',
    },
  ],
} as const satisfies ComponentMeta;
