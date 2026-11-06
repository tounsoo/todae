---
'@tounsoo/todae': patch
---

Button.Root and a clamped Text.Root no longer watch themselves. They read whether a label or text is cut only when the pointer enters it or keyboard focus reaches it (for Text, also focus on a link, row or other holder around it), so a page of 1,000 Buttons or clamped Texts runs no observer instead of 2,000, and a clamped Text mounts its tip only once it is needed. Two things change: `data-todae-cut` now marks a clamped Text only while its tip is on, after a hover or keyboard focus found it cut, rather than whenever it is cut; and a Button child that swaps an icon for text from its own state, without the Button rendering again, changes the Button's icon-only look at the Button's next render rather than at once.
