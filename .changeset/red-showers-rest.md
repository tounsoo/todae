---
"@tounsoo/todae": patch
---

useLaneDrag counts the board's `scroll-padding` as a strip that sticky parts, such as lane names, cover. The board scrolls while the pointer is near that strip or over it, and a drop over it lands wholly in view, so an item reaches the start of a lane under its name. A board that already has `scroll-padding` now starts scrolling that far in from its edge.
