---
"@tounsoo/todae": minor
---

Breaking: useCombobox names its listbox by the field's Label, so spread the new `getLabelProps()` on it (or pass `aria-label` to `getListboxProps()`); `getTriggerProps().ref` is now a callback ref, so read `cb.triggerRef` for the element; Enter on a closed list goes to the form and creates nothing; and a `Field.ChipInput` `onCommit` that returns `false` now lets Enter through. Also new: `creating` and `createError` report async creates, one per label, `reset()` goes through the change callbacks with the `reset` reason, a sheet or dialog trigger is named by the Label and its text, and IME keys, Safari's included, are left to the input in useCombobox, Field.ChipInput, Composer and useMentions.
