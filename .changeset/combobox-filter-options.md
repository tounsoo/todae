---
"@tounsoo/todae": minor
---

useCombobox and useMentions triggers replace `filter` with `filterOptions(options, query)`, which returns the rows to show in order, so it can rank or cap them, and each change of the text starts the highlight at the first row.

- Rename `filter` to `filterOptions` and return the rows instead of a yes or no per row: `filterOptions: (options, query) => options.filter((option) => yourTest(option, query))`.
- `filterOptions` and `loadOptions` get the text trimmed, so drop your own `trim()`, and a loader no longer runs again for added spaces.
- `filterOptions` gets `''` while nothing is typed; return what the open list should show.
