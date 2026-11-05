---
'@tounsoo/todae': patch
---

A tooltip opens on focus only when the focus came from keys. Focus that follows a press, such as a click on the trigger or a menu closed by a click handing focus back to its trigger, no longer opens the trigger's tip and holds it there. Hover still shows the tip, and keyboard focus still opens it at once. On a coarse pointer, which has no hover, a tap no longer opens a tip; only keyboard focus does.
