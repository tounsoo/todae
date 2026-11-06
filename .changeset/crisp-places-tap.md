---
"@tounsoo/todae": patch
---

Button.Root and a clamped Text.Root no longer rebuild their observers or read layout when they render again unchanged. Button now measures again when a variant, class or style change cuts its label, and a clamped Text measures again when an attribute or inline style around it, including a shadow host's, cuts it.
