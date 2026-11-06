---
"@tounsoo/todae": minor
---

Popover.Root, Coachmark.Root and the ChipList panel now mount their content on the first open and keep it mounted after it, so a page of closed comboboxes, chip lists and coachmarks renders none of their content until one opens.

- What a popover holds is no longer in the DOM before it first opens, though the popover element and its id are. Code or tests that find content inside a closed popover, such as a combobox's listbox and options, a coachmark's title, or ChipList's folded chips, or that read a ref to it, should open it first: pass `open` or `defaultOpen` to the hook that drives it, or press ChipList's +N button.
- `useCombobox` sets `aria-controls` on its input, and on its trigger in a sheet or dialog, only while the list is open, since the listbox is no longer in the page before the first open.
- Form fields placed inside a `Popover.Root` that never opened are not in the page, so until it has opened once a form around it neither submits their values nor checks them, and a `required` field there no longer blocks the submit. Keep fields a form needs outside the popover, or validate them yourself.
