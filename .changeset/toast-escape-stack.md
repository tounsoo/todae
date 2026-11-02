---
'@tounsoo/todae': minor
---

Toast takes Escape through Todae's Escape stack instead of stopping the key, so a layer inside a toast, such as a button's tooltip, closes first, and Toast.Region's code is split into focused hooks with no other change in behavior.

- Escape in a toast or on the region no longer stops propagation: it reaches your own `keydown` listeners with `defaultPrevented` set, so a listener of yours that should leave a key Todae took alone checks `event.defaultPrevented`.
- An open popover or menu shown after the toast now closes on Escape before the focused toast, as the Escape stack answers the layer shown last; press Escape again to dismiss the toast.
