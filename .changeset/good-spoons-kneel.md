---
'@tounsoo/todae': patch
---

Menu no longer resizes itself from a resize callback when it opens, which laid the frame out twice and made Chromium report a ResizeObserver loop.
