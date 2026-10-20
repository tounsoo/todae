---
"@tounsoo/todae": minor
---

Breaking: useCombobox names its listbox by the field's Label, so spread the new `getLabelProps()` on it (or pass `aria-label` to `getListboxProps()`); `getTriggerProps().ref` is now a callback ref, so read `cb.triggerRef` for the element; Enter on a closed list goes to the form and creates nothing; and `Field.ChipInput`'s `onCommit` now returns `boolean | void`, so a callback that returns another value, such as `(v) => list.push(v)`, no longer type-checks: return nothing, or `false` to let Enter through. `ComboboxCloseReason` gains `'reset'`. An `OptionList.Option` with `aria-disabled` stays reachable but can no longer be selected. Also new: `creating` and `createError` report async creates, one per label, `reset()` goes through the change callbacks with the `reset` reason, a sheet or dialog trigger is named by the Label and its text, and IME keys, Safari's included, are left to the input in useCombobox, Field.ChipInput, Composer and useMentions.
