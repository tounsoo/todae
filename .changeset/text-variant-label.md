---
"@tounsoo/todae": minor
---

Text.Root drops `size` and takes `variant="label"` for the label role.

- Remove `size`. Body text stays the medium scale, and a heading's `as` still picks its scale.
- Use `variant="label"` where you passed `size="label"`.
- Style any other scale through the `text.size.*` tokens or the consuming design system.
