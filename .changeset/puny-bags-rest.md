---
"@tounsoo/todae": minor
---

Field.OneTimeCode's caret blink reads field.code.caret.motion.duration, and Conversation.ScrollButton's glide reads the new conversation.motion.duration.glide and keeps the same pace at any refresh rate.

- Rename the `field.code.caret.blink-duration` theme override to `field.code.caret.motion.duration`, and `--todae-field-code-caret-blink-duration` to `--todae-field-code-caret-motion-duration`.
