---
'@tounsoo/todae': patch
---

Calendar makes each date formatter once per locale, and in range mode an inline `isDateDisabled` no longer starts the reach scan over on every render, so far days stay reachable.
