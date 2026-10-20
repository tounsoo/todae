---
"@tounsoo/todae": patch
---

ScrollArea and Conversation.Viewport now take their own Tab stop when every control inside is hidden, has a negative `tabindex`, or sits under `aria-hidden="true"`, and count a `<video controls>` or `<audio controls>` as a control. They update when any attribute inside them changes, such as a class that hides a control; a stylesheet rule outside them that hides one is not seen until they resize. Toolbar's arrow keys skip a control under `aria-hidden="true"`, and Tab leaves a ChipList's overflow panel from its last shown control, whatever kind of control that is.
