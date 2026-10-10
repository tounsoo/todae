import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'GlyphsProvider',
  description:
    'Sets the glyphs Todae draws by itself, such as close crosses, check marks and chevrons, for its subtree, so they can come from your icon library. Renders no element; useGlyphs() reads the glyphs in effect.',
  props: [
    {
      name: 'glyphs',
      type: 'Glyphs',
      required: true,
      description:
        "The glyphs to change: close, check, chevron, separator and ellipsis. Each key left out comes from the nearest GlyphsProvider above; null brings back Todae's own. A part's own content still wins.",
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Subtree that uses these glyphs.',
    },
  ],
} as const satisfies ComponentMeta;
