---
'@tounsoo/todae': patch
---

Coachmark.Root no longer makes a `<dialog>` inert, so a Dialog, Drawer or BottomSheet its target opens, such as a combobox's dialog, takes focus as it opens and stays usable, even when the target names nothing in `aria-controls`.
