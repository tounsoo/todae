---
"@tounsoo/todae": minor
---

Text.Root drops `size` and takes `variant="label"` for the label role.

- Remove `size`. Body text stays the medium scale, and a heading's `as` still picks its scale.
- Use `variant="label"` where you passed `size="label"`.
- Set `font-size` from a `text.size.*` variable in your own CSS for any other scale. Changing the token resizes every use of that step.
