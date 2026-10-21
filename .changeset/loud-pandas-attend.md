---
"@tounsoo/todae": minor
---

Add `role="alertdialog"` to `Dialog.Root`, which keeps backdrop clicks from closing it and focuses its `Dialog.Close` on open.

- `Dialog.Root role="alertdialog"` no longer closes on a backdrop click and focuses its first `Dialog.Close`; pass `dismissOnBackdrop` or `initialFocusRef` to keep the old behavior.
- `Dialog.Root`'s `role` takes only `'dialog'` or `'alertdialog'`.
- `Drawer.Root` no longer takes `role`; remove it.
