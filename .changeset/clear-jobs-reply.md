---
"@tounsoo/todae": patch
---

Field.Root uses about 1 kB less memory per field: its internal registry keeps its methods on a shared prototype and makes each collection only when a part needs it.
