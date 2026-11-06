---
'@tounsoo/todae': patch
---

Tabs.List, scroll-edge arrows and useRovingFocus now share one ResizeObserver and one child-list MutationObserver for the whole page, and the arrows and tab lists measure together before paint instead of one at a time, so a page of many tab lists mounts without laying the page out again for each one.

Code that reads a tab list's scroll position in its own layout effect now sees it before the list scrolls to a newly selected tab; the scroll is still in place before the browser paints.
