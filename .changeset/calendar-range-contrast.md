---
'@tounsoo/todae': minor
---

The token build and ThemeProvider's override check now hold `calendar.day.fg.range` on `calendar.day.bg.range` to APCA Lc 60 over `popover.bg` and each page surface, as they already did for a selected option's text.

- If your theme's calendar range text misses Lc 60 on its tint, `todae-tokens build` now fails and names the nearest lightness that passes. Set that lightness, or retune the pair in your resolver's contrast list.
