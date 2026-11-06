---
'@tounsoo/todae': patch
---

Coachmark.Root no longer makes a closed or modal `<dialog>` inert, wherever it sits, so a Dialog, Drawer or BottomSheet its target opens, such as a combobox's dialog, takes focus as it opens and stays usable, even when the target names nothing in `aria-controls`. With `dismissOnBackdrop`, a press in a modal dialog no longer closes the coachmark. An open dialog that isn't modal is still dimmed with the page.
