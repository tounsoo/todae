---
"@tounsoo/todae": patch
---

Escape now closes Menu, Popover, Tooltip and Toast rendered into an iframe or a popup window and returns focus there, focus moving inside one of them there no longer counts as leaving it, and Escape in one document no longer closes a layer in another.
