---
"@tounsoo/todae": patch
---

Calendar makes each date formatter once per locale instead of on every render, and in range mode a new isDateDisabled, such as an inline function, no longer starts the reach scan over, so far days stay reachable while the parent re-renders; the newest isDateDisabled checks the days between the picks before a range ends.
