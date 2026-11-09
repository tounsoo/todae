# 0014. Typed inputs are Field parts, and pickers are composed

- **Date:** 2026-11-09
- **Status:** Active
- **Source:** Ben's answers in the Duet thread on splitting the Field pickers out of the main bundle, 2026-11-09, and [ARCHITECTURE.md](../../ARCHITECTURE.md#component-api).

## Decision

- Anything a person types into is a Field part: `Field.DateInput`, `Field.TimeInput`, `Field.DateTimeInput` and `Field.DateRangeInput` join `Field.TextInput` and `Field.NumberInput`.
- What opens a popover is one part, `Field.Picker`: a button in the field around any panel, such as `Calendar.Root`, an `OptionList.Root` of `timeOptions`, or `ColorPicker.Root` with `swatch`.
- `Field.DatePicker`, `Field.TimePicker`, `Field.DateTimePicker`, `Field.DateRangePicker` and `Field.ColorPicker` are removed, with no aliases, since Todae is 0.x.
- No `TimeList`: a list of times is an OptionList of `timeOptions`.
- No `DateTimeCalendar`: a date and time picker is a docs recipe, a Calendar and a list of times in one `Field.Picker` with `closeOnPick={false}`. Its two `field.date-time` tokens are removed.

## Why

Todae is a system to build design systems, so it is more flexible than a component library, and its rule has to be clear. Ben chose the clearer rule over the smaller bundle ("Clearer rule wins"), and asked to compose rather than wrap parts ("Stop making HOC when it can be composited").
