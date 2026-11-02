---
'@tounsoo/todae': minor
---

Field.Root keeps one registry of its controls, so `useField`, the pickers, Field.Counter and the step buttons share how a field decides which control owns its id, name and focus.

- `data-todae-field-control` is now always empty on a control from `useField().getControlProps()`; it no longer reads `"name"` for the control that took the field's name. Don't select on its value, and `FieldControlWire['data-todae-field-control']` is typed `''`.
- Field pickers' buttons no longer carry `data-todae-field-picker`. Find a picker by its role and name instead.
- Field.Counter outside Field.Root now throws "Field parts must be rendered inside Field.Root", like the other Field parts.
- Field.Counter shows nothing once its Field.TextInput or Field.Textarea unmounts, instead of the last count.
