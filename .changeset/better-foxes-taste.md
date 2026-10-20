---
"@tounsoo/todae": minor
---

useCombobox now names its listbox by the field's Label, so spread the new `getLabelProps()` on that Label (or pass `aria-label` to `getListboxProps()`); `getTriggerProps(props)` merges your props with a callback `ref`, `reset()` calls the change callbacks with a `reset` reason, and the new `creating` and `createError` report an async create, which a later pick, clear, typing or reset now overrides. Enter and chip commit keys on a closed list are left to the form, and IME keys, Safari's included, are left to the input in useCombobox, Field.ChipInput, useHotkey and Toast.
