---
"@tounsoo/todae": patch
---

Fix focus on close when `restoreFocusRef` changes while an overlay that takes it is open, such as `Dialog.Root`, `Drawer.Root`, `BottomSheet.Root` or `usePopover`.
