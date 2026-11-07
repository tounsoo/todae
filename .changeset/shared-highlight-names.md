---
"@tounsoo/todae": minor
---

useHighlight hooks that share a name now paint together into one Highlight, so one `::highlight(name)` rule styles them all, such as every combobox on a page; the name goes when the last hook holding it unmounts, and the hook mounted last sets its priority and type. Before, only the hook mounted last painted and the others lost their marks.
