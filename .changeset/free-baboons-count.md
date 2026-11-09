---
"@tounsoo/todae": patch
---

Tree and Toast.Region render less as they are used. A click or key in a Tree renders each item once but none of their labels, and only the group of an item that opens or closes. A new or changed toast renders only that toast.

Two Tree items opened or closed in the same update now both keep their change, where the second used to undo the first.
