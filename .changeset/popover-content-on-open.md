---
"@tounsoo/todae": minor
---

Popover.Root, Coachmark.Root and the ChipList panel now mount their content on the first open and keep it mounted after it, so a page of closed comboboxes, chip lists and coachmarks renders none of their content until one opens.

- What a popover holds is no longer in the DOM before it first opens, though the popover element and its id are. Code or tests that find content inside a closed popover, such as a combobox's listbox and options, a coachmark's title, or ChipList's folded chips, or that read a ref to it, should open the popover first or pass `defaultOpen`.
- `useCombobox` sets `aria-controls` on its input, and on its trigger in a sheet or dialog, only while the list is open, since the listbox is no longer in the page before the first open.
- Form fields placed inside a `Popover.Root` that never opened are not in the page, so a form around it does not submit them until the popover has opened once.
