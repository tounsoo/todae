---
"@tounsoo/todae": minor
---

Breaking:

- useCombobox names its listbox by the field's Label, so spread the new `getLabelProps()` on it (or pass `aria-label` to `getListboxProps()`).
- `getTriggerProps().ref` is now a callback ref, so read `cb.triggerRef` for the element.
- Enter with nothing to pick, on a closed list or on an open list with no rows, goes to the form and creates nothing.
- `Field.ChipInput`'s `onCommit` now returns `boolean | void`, so a callback that returns another value, such as `(v) => list.push(v)`, no longer type-checks. Return nothing, or `false` to let the key through.
- `ComboboxCloseReason` gains `'reset'`, so a `switch` over it that checks every reason needs a new case.
- An `OptionList.Option` with `aria-disabled` stays reachable, and a click makes it active, but it can no longer be selected.

Also:

- `creating` and `createError` report async creates. `onCreate` runs once per label while its create is pending. A pick, `clear()` or `reset()` drops a pending create, and running its label again takes it back.
- `reset()` goes through the change callbacks with the `'reset'` reason. A controlled owner gets the `default*` props, or empty values.
- A change callback runs only when its part changes, so picking the option that is already selected no longer calls `onValueChange`.
- A held Enter, or a held commit key in `Field.ChipInput`, commits once.
- A sheet or dialog trigger is named by the Label and its text.
- useCombobox and `Field.ChipInput` leave IME keys to the input, Safari's composition-ending Enter included. useMentions and Composer now treat `keyCode` 229 as part of a composition only on Enter, and on Tab in useMentions, so an arrow, Escape or Backspace that carries 229 outside a composition works.
