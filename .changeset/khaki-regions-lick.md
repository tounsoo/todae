---
"@tounsoo/todae": patch
---

Popover and Menu now fade and grow from their trigger (popover.motion.* tokens, scale 0.96, 240ms in and 200ms out) and shrink back as they close, in Safari too, and Dialog's panel rises into place (dialog.motion.offset) while Dialog slows from 200ms in and 160ms out to 280ms in and 200ms out; under reduced motion Dialog keeps its fades, and a tooltip inside a growing popover waits for it to settle.
