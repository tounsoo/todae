---
"@tounsoo/todae": minor
---

Checkbox.Root, Switch.Root and RadioGroup.Root now follow a form reset, so `data-checked` and the stored value match what the form put back, `onCheckedChange` or `onValueChange` reports the value the reset put back, and the first change after it is reported again.

- RadioGroup.Root's `onValueChange` now takes `string | null`, and gets `null` when a form reset leaves no radio selected. Replace a callback typed `(value: string) => void`, such as a `useState<string>` setter, with one that takes `string | null`, or map `null` to your own empty value.
