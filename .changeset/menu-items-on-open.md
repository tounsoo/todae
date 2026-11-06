---
'@tounsoo/todae': minor
---

Menu.Content and Menu.SubmenuContent now mount their items on the first open and keep them mounted after it, so a page of closed row menus renders no items until one opens.

- A menu's items are no longer in the DOM before it first opens. Code or tests that find an item, or read a ref to one, before the menu opens should open it first, or pass `defaultOpen` to `Menu.Root` (and to `Menu.Submenu` for a submenu's items).
