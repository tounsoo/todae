---
"@tounsoo/todae": minor
---

Breaking: a trigger handler you pass to `usePopover`, `useTooltip`, `Button.Root` or a `Field` picker that calls `preventDefault()` now stops Todae from opening or toggling, as the component docs describe. If your trigger is an `<a href>` whose `onClick` calls `preventDefault()`, make it a `<button>`, or stop calling `preventDefault()`.
