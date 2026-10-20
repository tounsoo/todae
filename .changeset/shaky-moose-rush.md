---
"@tounsoo/todae": minor
---

Breaking: a trigger handler you pass in that calls `preventDefault()` now stops Todae's own behavior. A prevented `onClick` stops `usePopover`'s `getTriggerProps` from toggling, and stops a click on the button of `Field.ColorPicker`, `Field.DatePicker`, `Field.TimePicker` or `Field.DateTimePicker` from opening it. A press elsewhere in the field still opens a picker that is the field's control. A prevented `onPointerEnter` or `onFocus` stops `useTooltip`'s `getTriggerProps` and `Button.Root`'s automatic tooltip from opening. If your trigger is an `<a href>` whose `onClick` calls `preventDefault()`, make it a `<button>`, or stop calling `preventDefault()`.

`Button.Root` no longer drops your `aria-describedby` while its automatic tooltip is on, and `Button.Root` and `useTooltip` add the tip's id to it while the tip is open.
