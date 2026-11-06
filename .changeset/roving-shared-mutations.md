---
'@tounsoo/todae': patch
---

`useRovingFocus` and `useHighlight` now share one page-wide MutationObserver with each other and with Tabs and scroll arrows, instead of building one per copy, so a page of 1,000 tab lists or toolbars has one MutationObserver in place of 1,001. What each hook notices is unchanged.
