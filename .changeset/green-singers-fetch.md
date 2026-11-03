---
"@tounsoo/todae": patch
---

Checkbox.Root, Switch.Root and RadioGroup.Root now follow a form reset, so `data-checked` and the stored value match what the form put back, `onCheckedChange` or `onValueChange` reports the reset, and the first change after it is reported again.
