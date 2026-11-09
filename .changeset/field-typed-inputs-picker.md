---
'@tounsoo/todae': minor
---

Field gets typed inputs for dates and times, and one Field.Picker that opens any panel.

- New: Field.DateInput, Field.TimeInput, Field.DateTimeInput and Field.DateRangeInput. Each is a text input the person types into in the locale's own formats. It reads the text on blur, Enter or a submit, sends the value as HTML writes it, and blocks a submit while the text says no value.
- New: Field.Picker, a button in the field that opens a popover around a Calendar.Root, an OptionList.Root, a ColorPicker.Root or a panel of your own. A pick in a Calendar or OptionList closes it, unless `closeOnPick` is false. Beside a typed input it takes its name and glyph from that input, and with `swatch` it is a color swatch.
- Field.Picker's popover opens under the whole field. Where the panel is taller than the room above and below the field, as a calendar with times under it can be on a phone, it fits the room on one side and scrolls, in browsers with CSS `position-area`.
- New: `timeOptions`, the times for an OptionList of times.
- Breaking: Field.DatePicker, Field.TimePicker, Field.DateTimePicker, Field.DateRangePicker and Field.ColorPicker are removed. Use a typed input with a Field.Picker beside it, or for a color, a Field.TextInput beside a Field.Picker with `swatch`. Field.Picker sends no form value of its own.
- Breaking: the `field.date-time.gap` and `field.date-time.list.max-height` tokens are removed. The date and time picker is now a docs recipe.
- Breaking: Strings has a new `picker` string, Field.Picker's name with no typed input beside it and no `swatch`. A full Strings object of your own needs it; StringsProvider's partial strings don't.
