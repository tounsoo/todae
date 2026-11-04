---
"@tounsoo/todae": minor
---

Focus ring, Link, Disclosure, Form summary link and ColorPicker thumb tokens no longer name a sub-property where a state goes: a width, offset, radius or thickness joins its property with a hyphen (`focus.ring-width`), and a ring or border color is the bare property (`focus.ring`).

- Rename `focus.ring.color` to `focus.ring`, and read `--todae-focus-ring` instead of `--todae-focus-ring-color`.
- Rename `focus.ring.width` and `focus.ring.offset` to `focus.ring-width` and `focus.ring-offset`. Their `--todae-*` names don't change.
- Rename `link.ring.radius`, `disclosure.ring.radius` and `form.summary.link.ring.radius` to `link.ring-radius`, `disclosure.ring-radius` and `form.summary.link.ring-radius`. Their `--todae-*` names don't change.
- Rename `link.decoration.thickness` to `link.decoration-thickness.default` and `link.decoration.current-thickness` to `link.decoration-thickness.current`, and read `--todae-link-decoration-thickness-default` and `--todae-link-decoration-thickness-current`.
- Rename `link.decoration.offset`, `form.summary.link.decoration.thickness` and `form.summary.link.decoration.offset` to `link.decoration-offset`, `form.summary.link.decoration-thickness` and `form.summary.link.decoration-offset`. Their `--todae-*` names don't change.
- Rename `picker.thumb.border.color` to `picker.thumb.border`, and read `--todae-picker-thumb-border` instead of `--todae-picker-thumb-border-color`. Rename `picker.thumb.border.width` to `picker.thumb.border-width`; its `--todae-*` name doesn't change.
- Make each rename in token packages and `ThemeProvider` overrides too. A token package now fails to build when it declares a token under another token, such as the old `focus.ring.color` under `focus.ring`, or two tokens that write one `--todae-*` variable, such as `brand.gap.x` and `brand.gap-x`.
