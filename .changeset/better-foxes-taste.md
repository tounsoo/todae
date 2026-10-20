---
"@tounsoo/todae": minor
---

useCombobox names its listbox by the field's Label, so spread the new `getLabelProps()` on that Label (or pass `aria-label` to `getListboxProps()`); in a sheet or dialog, the trigger is named by that Label and its own text. `getTriggerProps(props)` merges your props, and its `ref` is now a callback ref, so read `cb.triggerRef` for the element. `reset()` goes through the change callbacks, and `onOpenChange` gets the `reset` reason. The new `creating` and `createError` report async creates, which run one per label. Enter with nothing to commit is left to the form. `Field.ChipInput`'s `onCommit` may return `false` to leave the key to the input and its form, so a callback that already returns `false` now lets Enter through. IME keys, Safari's included, are left to the input in useCombobox, Field.ChipInput, Composer, useMentions, useHotkey and Toast.
