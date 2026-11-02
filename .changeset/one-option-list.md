---
"@tounsoo/todae": minor
---

BREAKING: useCombobox and useMentions now share one option-list engine, so their async loading, active row and arrow keys behave the same way.

- useCombobox shows the options `loadOptions` returns as they are, and `filter` now applies only to sync `options`. If you relied on the label filter to narrow loaded options, match them in your loader.
- useCombobox loads the full list, `loadOptions('')`, while the input shows the selected label in single mode, as it already shows sync options. It no longer loads the label's text.
- With no active row, ArrowUp moves to the last row in both hooks. useCombobox used to move to the first.
- useMentions keeps the trigger's last suggestions on show while the next query loads, and Enter picks nothing until the new list is in, as useCombobox already did. Text changing before the word no longer reloads its suggestions.
- While the next query loads, no row is active in either hook unless the user highlights one during that load. useCombobox used to keep a row highlighted on the last list.
- A row the user highlights stays active in useCombobox while the list changes around it, instead of jumping back to the selected value. In both hooks, a highlight whose row leaves the list is forgotten and does not come back with the row.
