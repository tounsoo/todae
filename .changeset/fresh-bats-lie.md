---
'@tounsoo/todae': patch
---

Calendar makes each date formatter once per locale instead of on every render, and in development `Calendar.Root` logs an error when a new `isDateDisabled` on each render keeps a range's far days out of reach.
