---
"@tounsoo/todae": minor
---

Text and Prose drop their component type-scale size tokens and use `font.size.*`.

- Remove `text.size.2` through `text.size.6` and `--todae-text-size-*`. Set the size from `font.size.*` (`--todae-font-size-*`). Body stays step 3. Headings stay h1 on 6, h2 on 5, h3 on 4, h4 and h5 on 3, and h6 on 2.
- Remove `prose.size` and `prose.h1.size` through `prose.h6.size`, plus `--todae-prose-size` and `--todae-prose-h1-size` through `--todae-prose-h6-size`. Prose uses the same steps.
