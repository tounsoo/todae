---
'@tounsoo/todae': minor
---

Chip.Overflow is removed; a +N count is a plain `Chip.Root`.

- Replace `<Chip.Overflow overflowCount={n} />` with a `Chip.Root` holding the text, such as `<Chip.Root aria-hidden>+4</Chip.Root>`, and a `VisuallyHidden.Root` holding its name, such as `moreChips(n)` from `useStrings`. `ChipOverflowProps` is gone, and a +N chip no longer has a dashed border.
