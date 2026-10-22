---
"@tounsoo/todae": minor
---

`Tooltip.Root` renders a `<span>` instead of a `<div>`, so a trigger and its tip can sit inside a paragraph, and logs a development error for block content in a tip.

- `Tooltip.Root` and its tip are `<span>` elements, and its props and ref are a span's; retype an `HTMLDivElement` ref as `HTMLSpanElement`, and move CSS that selects them as `div`.
- A tip that holds block content, such as a `<p>` or `<div>`, logs a development error; keep a tip's content to phrasing content.
