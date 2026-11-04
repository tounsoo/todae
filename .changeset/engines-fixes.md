---
"@tounsoo/todae": patch
---

Fixes found by running the browser tests in Firefox and WebKit as well as Chromium.

- `useSelection`: Shift+Space on a row checkbox selects a range in Firefox too. Firefox's click from Space carries no Shift, so `getCheckboxProps` now also returns an `onKeyUp` that notes it.
- `Field.OneTimeCode` inside a shadow root: the box that shows the caret follows arrow keys in Firefox and Safari, which don't send the input's `selectionchange` out of the shadow root.
- `ColorPicker`: a press in the area still picks a color when the browser refuses pointer capture, instead of throwing. The thumb's focus ring comes from a sibling selector rather than `:has()`, so Safari has it in place when a scroll container brings the ring into view.
- `ChipList`: the +N panel stays on screen when neither its start nor its end can line up with +N.
- A Popover or Menu whose anchor went away as it closed, such as the mention list after a pick, now goes at once in Firefox and Safari, as it does in Chrome.
- Toasts start timing again in Firefox when the toast under a resting pointer is removed.
