---
"@tounsoo/todae": minor
---

Field.DatePicker, Field.TimePicker, Field.DateTimePicker and Field.ChipInput carry their value in a validated input, with required, min and max, and useField().getValueInputProps with notifyValueChange does so for custom controls.

- A picker with `min` or `max` now blocks a submit, and shows a problem in `Form.Root`, when its value is outside them; give a value in range, or drop the bound.
- `required` on `Field.ChipInput` now needs at least one chip, not text in the input.
- `Strings` has three new keys, `required`, `dateRangeUnderflow` and `dateRangeOverflow`; add them to an object you type as a complete `Strings`.
