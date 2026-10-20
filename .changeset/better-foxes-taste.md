---
"@tounsoo/todae": patch
---

useCombobox: an async create runs once and keeps picks made while it is pending, and a rejected one lands in `error`; Enter on a closed list is left to the form; Safari's IME-ending Enter no longer picks an option or commits a Field.ChipInput chip; the listbox is named by the field's label through the new `ids.label`; `reset()` goes through the change callbacks, so a controlled combobox resets; and `getTriggerProps(props)` merges your props and ref and skips the toggle when your `onClick` calls `preventDefault()`.
