---
"@tounsoo/todae": patch
---

Fix `useReorder` so the first drag after a drop starts in WebKit, and a drag that starts but never runs, as a touch drag in Chromium can, ends when the pointer is released.
