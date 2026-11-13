---
"@tounsoo/todae": patch
---

useReorder: the handlers from getItemProps, getHandleProps and getListProps keep their identity from render to render, and getHandleProps(index) with no props of yours returns the same object. A memoized row that takes getItemProps(index) spread now renders only when its own data-dragging or data-drop changes, so a drag step in a long list no longer renders every row.
