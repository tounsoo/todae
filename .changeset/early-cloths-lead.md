---
"@tounsoo/todae": patch
---

useMentions' suggestion list and its caret peek now fade out where they sat as they close, as Popover and Menu do, instead of vanishing at once.
A closed list keeps its last rows, and its `loading` and `error`, until the next word, so it fades out showing what it showed.
