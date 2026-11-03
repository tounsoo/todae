---
"@tounsoo/todae": patch
---

useTooltip opens a hover tip immediately while another hover tip is open, and for that tip's `skipDelay` milliseconds after the last hover tip closes. A `skipDelay` of 0 or less turns skipping off, so that tip always waits its show delay.
