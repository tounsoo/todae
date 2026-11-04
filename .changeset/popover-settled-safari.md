---
'@tounsoo/todae': patch
---

Popover and Menu no longer dip and fade in a second time in Safari as they finish opening. Once the opening fade ends, the popover takes `data-todae-settled` and drops its transition until it closes, so Safari's re-resolution of the position fallbacks has nothing to run again.
