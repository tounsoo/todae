---
"@tounsoo/todae": patch
---

`parseDateTime`, `parseDate` and `parseTime` are faster: they work out each digit's value only once, and `parseDateTime` splits each part of the text into words once, however many ways it tries to cut it.
