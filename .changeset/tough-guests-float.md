---
"@tounsoo/todae": patch
---

`parseDateTime`, `parseDate` and `parseTime` are faster: they work out each digit's value once, and split the text into words once per cut.
