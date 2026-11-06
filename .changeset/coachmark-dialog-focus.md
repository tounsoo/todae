---
'@tounsoo/todae': patch
---

A Dialog, Drawer or BottomSheet that opens under an open Coachmark.Root, such as a combobox's dialog its target opens, now takes focus as it opens and stays usable wherever it sits, even when the target names nothing in `aria-controls`; before, it opened inert and focus stayed on the trigger. A page's own `<dialog>` is lifted the same way where the browser sends `beforetoggle`. With `dismissOnBackdrop`, a press in such a dialog no longer closes the coachmark. Closed dialogs, and open ones that aren't modal, are still dimmed with the page.
