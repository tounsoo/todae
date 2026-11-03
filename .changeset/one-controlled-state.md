---
"@tounsoo/todae": minor
---

Todae's controlled-state hooks and components now share one model, the public `useControlledState`, which takes the change callback and replaces `useControlledValue`.

- Replace `useControlledValue(value, defaultValue, onChange)` with `useControlledState(value, defaultValue, onChange)`. Its setter builds on the latest write, so a value set twice in one event calls `onChange` once.
- Where you called `useControlledState(value, defaultValue)` and then your callback yourself, pass the callback as the third argument and drop your own call. The setter now calls it, and a controlled value with no callback stays read-only.
- `useControlledState` returns a third item, `latest()`. Code that spreads or checks the tuple's length sees three items.
- A toggle Button and Menu.CheckboxItem pressed twice before a render now toggle twice, and the second press no longer reports the first value again.
- useCombobox reports each change only after every change of a pick or edit is stored, and drops a report that the owner's own later request from a change callback has replaced. So an owner that keeps the list open or sets its own text from onValueChange gets what it asked for.
- A controlled value with no change callback is read-only, so a press, Escape or an outside press doesn't render Menu.RadioGroup, Menu.Root, ToggleGroup, a Field picker or a useCombobox popover again. A Menu.Trigger click also drops a context request the owner turned down.
- Checkbox.Root, Switch.Root and RadioGroup.Root report taking both the controlled and the default prop once, not on every render.
- Slider.Root from `@tounsoo/todae` reads the nearest Fieldset: a disabled Fieldset disables it, and an invalid one sets `aria-invalid`, which the slider's own `aria-invalid` overrides. It also asks its validation scope to recheck as it renders, like the other controls. The server entry, `@tounsoo/todae/slider`, is unchanged.
