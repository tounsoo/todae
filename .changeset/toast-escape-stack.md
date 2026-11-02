---
'@tounsoo/todae': minor
---

Toast takes Escape through Todae's Escape stack instead of stopping the key, so a layer inside a toast, such as a button's tooltip, closes first, and Toast.Region's code is split into focused hooks with no other change in behavior.

- Escape in a toast or on the region no longer stops propagation: it reaches your own `keydown` listeners with `defaultPrevented` set, so a listener of yours that should leave a key Todae took alone checks `event.defaultPrevented`.
- A toast and the region join the Escape stack when focus comes into the region, so an overlay shown after that, such as a popover, now closes on Escape before them; press Escape again to dismiss the toast.
- A `keydown` handler of yours above `Toast.Region` that stops Escape's propagation now keeps the key from the toasts, as it already does from Todae's popovers and menus.
