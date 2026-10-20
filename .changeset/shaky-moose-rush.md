---
"@tounsoo/todae": patch
---

Button.Root keeps your aria-describedby when it shows its tooltip, useTooltip adds its tip to your aria-describedby instead of replacing it, and calling preventDefault in a handler you pass to usePopover or useTooltip's getTriggerProps now skips the open, close or toggle.
