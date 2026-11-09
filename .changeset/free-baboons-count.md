---
"@tounsoo/todae": patch
---

Tree and Toast.Region render less as they are used. A click or key in a Tree renders each item once, and the label and group only of an item that opens or closes. A new or changed toast renders only that toast.

Tree opens and closes build on the latest change in the same update: two items opened together both stay open, where the second used to undo the first, and `onExpandedChange` isn't called for a change the open items already have.
