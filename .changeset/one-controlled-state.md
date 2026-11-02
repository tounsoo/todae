---
"@tounsoo/todae": patch
---

Every part that holds a value a prop can own now follows one rule: a change builds on the change before it, even before a render, and a controlled change the owner doesn't pass back is dropped by the next render. Before, two changes in one event could both build on the stale value in Checkbox, Switch, RadioGroup, Tabs, Tree, Menu, ColorPicker, the dialogs and popovers, while useCombobox and useSelection each followed a rule of their own.

- Checkbox.Root, Switch.Root and RadioGroup.Root report taking both the controlled and the default prop once, not on every render.
- Slider.Root from `@tounsoo/todae` reads the nearest Fieldset: a disabled Fieldset disables it, and an invalid one sets `aria-invalid`, which the slider's own `aria-invalid` overrides. It also asks its validation scope to recheck as it renders, like the other controls. The server entry, `@tounsoo/todae/slider`, is unchanged.
- `useControlledState` and `useControlledValue` keep their documented behavior.
