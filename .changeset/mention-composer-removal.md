---
"@tounsoo/todae": minor
---

BREAKING: Remove Composer, including its send and stop strings and glyphs.

- Build the chat composer from the recipe at /recipes/chat-composer-mentions, with Field, Button, Attachment, and useMentions. Pass that same mention source to MentionText.
- Delete `send` and `stop` from Strings and Glyphs.
