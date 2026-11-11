import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useGlyphs',
  description:
    "useGlyphs() returns the glyphs in effect: the nearest GlyphsProvider's, merged over its parents'. An unset or null key means Todae's own glyph.",
  props: [],
} as const satisfies ComponentMeta;
