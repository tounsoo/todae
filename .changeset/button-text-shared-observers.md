---
'@tounsoo/todae': patch
---

A clamped Text.Root now shares one ResizeObserver and one MutationObserver for the whole page instead of building its own. Button.Root reads whether its label is cut only when the pointer or focus reaches it, and a Button whose children are text and `Button.Icon`s watches nothing, so a page of 1,000 such Buttons runs no observer instead of 2,000; a Button with other children shares the page's one MutationObserver.
