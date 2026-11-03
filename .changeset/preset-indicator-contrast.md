---
"@tounsoo/todae": minor
---

Todae's contract set now checks indicator and pill contrast: progress and meter fills on `progress.track` and the switch thumb and check on `selection.bg.checked` need Lc 30, and primary button text on each of its four fills and `mention.fg.default` on `mention.bg.hover` need Lc 60.

- A company token build inherits these pairs, so a resolver that built on 0.5.2 can now stop with "contrast: N pair(s) fail APCA", for example a primary button on `color.red.500` with Todae's dark text. Set the token to the lightness the error names, or lower that pair's `min` with an entry of the same `fg` and `bg` in your resolver's `$extensions["dev.todae"].contrast`. In development, `ThemeProvider` overrides now also warn on these pairs.
