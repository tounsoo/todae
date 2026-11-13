---
"@tounsoo/todae": patch
---

useLaneDrag counts the board's `scroll-padding` as a strip that sticky parts, such as lane names, cover. The board scrolls while the pointer is near that strip or over it, and a drop over it lands wholly in view where the item fits, so an item reaches the start of a lane under its name. The edge now counts from inside the board's border and scrollbars, and a board that already has `scroll-padding` starts scrolling that far in.
