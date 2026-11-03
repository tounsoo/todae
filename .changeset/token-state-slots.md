---
'@tounsoo/todae': minor
---

Todae's token resolver now declares each component's own state words, such as `option.bg.selected` and `tabs.fg.selected`, as `slots` on that component's stateful properties, so the token build holds those groups to exactly the words listed.

- A company resolver can no longer add a new child under one of these groups (for example `option.bg.pressed` or `focus.ring.style`), whether in its own set or in an extension of Todae's `contract` or `focus` set. Put a new state in a token group of your own, such as `brand.*`, or set the existing tokens' values instead.
