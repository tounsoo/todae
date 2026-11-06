---
'@tounsoo/todae': patch
---

A closed Popover, Menu, Menu submenu or Coachmark no longer does open-state work: its scroll-edge arrows mount on the first open and measure and watch only while it is open, and a popover reads its anchor's position only as it opens or closes, so pages with many closed menus or popovers mount faster.
