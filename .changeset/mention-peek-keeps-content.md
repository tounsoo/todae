---
'@tounsoo/todae': patch
---

A `Mention.Root` peek keeps what it showed once it closes, so the card fades out with its content instead of as an empty box. Before its first open the peek still renders nothing, so server HTML holds an empty span.
