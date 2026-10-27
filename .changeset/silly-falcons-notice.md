---
"@tounsoo/todae": patch
---

Fix `useReorder` so the first drag after a drop starts in WebKit, and a drag that gets no `dragend`, such as a Chromium touch drag that never runs, ends soon after the pointer is released.
