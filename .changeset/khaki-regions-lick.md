---
"@tounsoo/todae": patch
---

Popover and Menu now fade and grow from their trigger (popover.motion.* tokens, scale 0.96) and shrink back as they close, and Dialog's panel rises into place (dialog.motion.offset); under reduced motion Dialog keeps its fades, and a tooltip inside a growing popover waits for it to settle.
