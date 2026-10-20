---
"@tounsoo/todae": minor
---

Breaking: a trigger `onClick` you pass in that calls `preventDefault()` now stops the toggle of `usePopover`'s `getTriggerProps`, `Menu.Trigger` and the `Field.ColorPicker`, `Field.DatePicker`, `Field.TimePicker` and `Field.DateTimePicker` buttons, and a prevented `onPointerEnter` or `onFocus` stops `useTooltip`'s `getTriggerProps` and `Button.Root`'s automatic tooltip from opening, so an `<a href>` trigger should become a `<button>` or stop calling `preventDefault()` in that `onClick`. `Button.Root` and `useTooltip` now add the tip's id to your `aria-describedby` instead of replacing it.
