---
"@tounsoo/todae": minor
---

Adds Field.NumberInput with Field.Increment and Field.Decrement, and removes Field.TextInput type="number".

- `Field.TextInput type="number"` is gone; use `Field.NumberInput`, whose value is a `number | null`, and which reads and writes the locale's format.
- `Strings` has two new keys, `increment` and `decrement`, which are given the text of the field's label (`(field: string) => string`, with `field` empty without a label); add them to an object you type as a complete `Strings`.
- `Glyphs` has two new keys, `plus` and `minus`; add them to an object you type as `Required<Glyphs>`.
