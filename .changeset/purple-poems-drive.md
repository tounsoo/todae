---
"@tounsoo/todae": minor
---

Calendar.Root takes mode="range", and Field.DateRangePicker, formatDateRange and parseDateRange pick and type a range of dates.

- `CalendarRootProps` is a union on `mode`; narrow it by `mode` before reading `value`, `defaultValue` or `onValueChange` in a wrapper's own types.
- `Strings` has two new keys, `dateRangePicker` and `pickEndDate`; add them to an object you type as a complete `Strings`.
