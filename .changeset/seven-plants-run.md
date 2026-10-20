---
"@tounsoo/todae": patch
---

Button.Root, Menu.Item and Toast.Action take a render prop, so a link can carry the button look or be a menu item. Keys now choose a menu item through a click, so its onClick runs for Enter and Space too, and an onClick that calls preventDefault() stops a key from choosing the item, as it already stopped a click.
