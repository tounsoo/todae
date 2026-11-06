---
'@tounsoo/todae': patch
---

Button.Root and a clamped Text.Root now share one ResizeObserver and one MutationObserver for the whole page instead of building their own, so a page of 1,000 Buttons runs 2 observers instead of 2,000.
