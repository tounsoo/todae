---
"@tounsoo/todae": minor
---

Every component that animates as it opens and closes now has `motion.duration.enter`, `motion.duration.exit`, `motion.easing.enter` and `motion.easing.exit` tokens, and the core `motion.easing.exit` curve speeds up as it leaves (`cubic-bezier(0.4, 0, 1, 1)`), so Dialog, Drawer, BottomSheet, Toast, Disclosure, Nav, Tree and Message close faster at the end.

- Rename `dialog.motion.enter` and `exit`, `drawer.motion.enter` and `exit`, `sheet.motion.enter`, `exit` and `resize`, and `toast.motion.enter` and `exit` to `<component>.motion.duration.enter`, `exit` and `resize`, in token packages, `ThemeProvider` overrides and `--todae-*` reads.
- Replace `disclosure.motion.duration`, `nav.motion.duration`, `tree.motion.duration` and `message.actions.motion.duration` with their `.enter` and `.exit` tokens.
- Dialog, Drawer, BottomSheet and Toast now read their own `<component>.motion.easing.enter` and `exit`, which point at `overlay.motion.easing.*`. CSS that read `--todae-overlay-motion-easing-*` to match them still works.
