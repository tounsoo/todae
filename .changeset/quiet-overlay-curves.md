---
"@tounsoo/todae": minor
---

The overlay motion tokens are simpler: Dialog, Drawer, BottomSheet, Toast, Popover and Coachmark now point their own `motion.easing.enter` and `exit` straight at the core `motion.easing.*`, Toast's rise is `toast.motion.offset`, and Coachmark's popup times its fades with `coachmark.motion.*`, as its scrim does. Nothing looks different.

- `overlay.motion.easing.enter` and `overlay.motion.easing.exit` are gone. A theme that set them sets the core `motion.easing.enter` and `exit` to change every curve, or a component's own `<component>.motion.easing.*` to change one.
- `toast.enter-offset` is now `toast.motion.offset`, and `--todae-toast-enter-offset` is now `--todae-toast-motion-offset`.
