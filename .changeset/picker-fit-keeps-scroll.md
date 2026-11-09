---
'@tounsoo/todae': patch
---

Field.Picker: a popover too tall for the room on either side of its field keeps its scroll in Chromium and Safari, so the end of a long panel can be reached. Before, those engines placed it again whenever a style on it changed, such as a scroll arrow showing, and its scroll jumped back to the top.
