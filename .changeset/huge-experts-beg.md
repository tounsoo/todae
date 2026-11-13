---
"@tounsoo/todae": patch
---

useReorder: the handlers in the props from getItemProps, getHandleProps and getListProps now keep their identity from render to render when you pass no handler of your own, so a memoized row that takes getItemProps(index) spread renders only when its own item props change, not on every drag step of a long list.
