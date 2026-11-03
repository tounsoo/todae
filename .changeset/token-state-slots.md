---
'@tounsoo/todae': minor
---

Todae's token resolver now declares each component's own state words, such as `option.bg.selected` and `steps.fg.done`, as `slots` on that component's stateful properties, so the token build holds those groups to exactly the words listed.

- A company resolver that extends Todae's `contract` or `focus` set can no longer add a new child under one of these groups (for example `option.bg.pressed` or `focus.ring.style`). Put a new state in a token group of your own, such as `brand.*`, or set the existing tokens' values instead.
