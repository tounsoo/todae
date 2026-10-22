---
"@tounsoo/todae": minor
---

DataList.Root takes `minItemSize` to lay its items out in columns, spaced by the new `datalist.gap.between-columns` token.

- Grid.Root's inline custom properties are now the private `--_column-count` and `--_min-item-size`, so CSS that set `--todae-grid-column-count` or `--todae-grid-min-item-size` no longer applies; set the `columns` or `minItemSize` prop instead.
