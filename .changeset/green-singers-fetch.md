---
"@tounsoo/todae": patch
---

Checkbox.Root, Switch.Root and RadioGroup.Root now follow a form reset, so `data-checked` and the stored value match what the form put back, `onCheckedChange` or `onValueChange` reports the value the reset put back, and the first change after it is reported again. A RadioGroup reset to no pick is not reported, since `onValueChange` takes only a value.
