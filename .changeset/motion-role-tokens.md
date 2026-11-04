---
"@tounsoo/todae": patch
---

Add motion role tokens, so a theme retimes every component of one kind in one place: `motion.reveal`, `motion.popup`, `motion.modal`, `motion.panel` and `motion.notice`, each with `duration.enter` and `duration.exit`, and point each component's enter and exit durations at its role, with every timing unchanged.

- `motion.reveal.duration.enter` and `exit` (200ms, 200ms): `disclosure`, `nav`, `tree` and `message.actions` `motion.duration.*`.
- `motion.popup.duration.enter` and `exit` (240ms, 200ms): `popover.motion.duration.*`, which Menu and the field pickers read too.
- `motion.modal.duration.enter` and `exit` (280ms, 200ms): `dialog.motion.duration.*`.
- `motion.panel.duration.enter` and `exit` (280ms, 240ms): `drawer` and `sheet` `motion.duration.enter` and `exit`.
- `motion.notice.duration.enter` and `exit` (200ms, 160ms): `toast.motion.duration.*`.
