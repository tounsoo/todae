# 0019. Day content and option details are part of the accessible name

- **Date:** 2026-11-27
- **Status:** Active
- **Source:** Ben's answers on pull request #526 (Nov 27 2026, 1:21pm PT). This replaces the Nov 17 2026 Calendar decision in `ARCHITECTURE.md`, which made a day's content its description.

## Decision

- A `Calendar.Grid` day button is named by its content. The name is the full date, then what `renderDay` drew. The date is visually hidden, and the day number on screen is hidden from the name and written in the locale's digits. The content is not a description.
- An `OptionList.Option` with an `OptionList.OptionDetail` is named by its title, then its detail, through `aria-labelledby`. The detail is not a description.
- Recipes name a control by what it shows first, in the order it shows it. Lines that stack as blocks have a space between them in the DOM.
- The rule stays on. axe-core is at 4.14, with `label-content-name-mismatch` enabled, in `apps/docs` and `packages/design-system`, and the components pass it. `packages/design-system/src/browser/labelInName.browser.test.tsx` checks the Calendar and OptionList names against axe and Chromium's accessibility tree in English, Korean and locales with their own digits.
- An open `Tree.Item` keeps its `aria-labelledby` name from its `Tree.Label` row. axe-core 4.14 counts an open item's child items as its visible label (dequelabs/axe-core#5505). `runAxe` in `apps/docs/test/axe.ts` reruns the same rule on such an item with its child group hidden, and keeps the failure when the row alone fails. `apps/docs/test/axeRun.browser.test.tsx` fails once axe no longer has that bug, and then the recheck is deleted.
- Day numbers in the locale's digits, such as Persian and Arabic-Indic, are accepted as they look.

## Why

WCAG 2.5.3 Label in Name asks that a control's accessible name hold the text it shows, so a speech user can say what they see. axe-core 4.14 turned `label-content-name-mismatch` on by default. Under it, a day showing "13 Review" named only "Tuesday, October 13, 2026", and an option showing "Apple / Crisp and sweet" named only "Apple", both fail. So did Korean days with no content, since Chrome's word segmenter keeps "13일" as one word. Ben chose names that hold the visible text over turning the rule off. He kept the Tree recheck for the axe bug until axe ships its fix, and accepted the locale digits.
