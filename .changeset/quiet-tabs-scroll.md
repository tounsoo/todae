---
"@tounsoo/todae": patch
---

ScrollArea and Conversation.Viewport now take their own Tab stop when every control inside is hidden, has a negative `tabindex`, or sits under `aria-hidden="true"`, and update when a control inside is hidden or shown later. Toolbar's arrow keys skip a control hidden by CSS or under `aria-hidden="true"`, and Tab leaves a ChipList's overflow panel from its last shown control, whatever kind of control that is.
