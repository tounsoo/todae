---
"@tounsoo/todae": minor
---

Table.SortButton draws a new `unsorted` glyph from GlyphsProvider, an arrow up beside an arrow down by default, on a column that isn't sorted, so it no longer shows the same arrow as an ascending column on touch screens.

- `Glyphs` has a new key, `unsorted`; add it to an object you type as `Required<Glyphs>`.
- If you set `sort` in GlyphsProvider, set `unsorted` too, or unsorted columns draw Todae's own glyph beside your icons.
