---
"@tounsoo/todae": minor
---

Tabs.List: a horizontal list that holds more tabs than fit now scrolls sideways in one row, with scroll arrows at its cut-off edges on by default (`arrows={false}` leaves them out), and scrolls a selected tab past its edge into view.

- If your CSS set `border-bottom` on a horizontal `Tabs.List`, the line under the tabs is now a background at the foot of the list: change its color and thickness with the `tabs.border` and `tabs.border-width` tokens instead.
