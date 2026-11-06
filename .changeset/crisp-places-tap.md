---
"@tounsoo/todae": patch
---

Button.Root and a clamped Text.Root no longer rebuild their observers or read layout when they render again unchanged, and Button now measures again when a variant or class change cuts its label.
