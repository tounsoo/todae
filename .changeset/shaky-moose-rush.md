---
"@tounsoo/todae": minor
---

Breaking: a `preventDefault()` in the `onClick` you pass to `usePopover`'s trigger or a `Field` picker's button now stops it from toggling (a press elsewhere in the field still opens a picker that is the field's control), and one in the `onPointerEnter` or `onFocus` you pass to `useTooltip`'s trigger or `Button.Root` now stops the tip from showing. If your trigger is an `<a href>` whose `onClick` calls `preventDefault()`, make it a `<button>`.
