---
"@tounsoo/todae": minor
---

Button.Root with `aria-disabled="true"` now looks disabled, keeps focus, and ignores clicks.

- `Button.Root` with `aria-disabled="true"` no longer calls `onClick`, flips a toggle, submits a form or follows a link, and `Composer.Root` sends nothing on Enter while its send button has it; drop guards in your own handlers.
