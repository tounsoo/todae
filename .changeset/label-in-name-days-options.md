---
'@tounsoo/todae': minor
---

Calendar.Grid days and OptionList options with an OptionList.OptionDetail are named by everything they show, so they pass WCAG 2.5.3 Label in Name.

- A Calendar.Grid day with `renderDay` content is named by its date and then that content, such as "Tuesday, October 13, 2026 Review", and has no description. Find it by that name, or by a name that starts with the date.
- A day button is named by its content, not `aria-label`, and shows its number in the locale's digits. Read a day's date from its accessible name, not `aria-label`.
- An OptionList.Option with an OptionList.OptionDetail is named by its title and then its detail, such as "Apple Crisp and sweet", through `aria-labelledby`, and the detail is no longer its `aria-describedby`.
