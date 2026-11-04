---
"@tounsoo/todae": minor
---

Fixes found by running the browser tests in Firefox and WebKit as well as Chromium.

- `Field.OneTimeCode`'s input no longer has `maxLength`. Safari cut a key typed at a caret inside a full code to nothing before the component saw it; the component keeps the code to `length` itself, as before. Code that read `maxLength` from the input gets -1.
- `Button`: in forced colors the focus ring is `Highlight`. Firefox drew a pressed toggle's ring in `HighlightText`, which can't be seen on the page; Chrome's ring may change color too.
- `useSelection`: Shift+Space on a row checkbox selects a range in Firefox too. Firefox's click from Space carries no Shift, so `getCheckboxProps` now also returns an `onKeyUp` that notes it.
- `Field.OneTimeCode` inside a shadow root: the box that shows the caret follows arrow keys in Firefox and Safari, which don't send the input's `selectionchange` out of the shadow root.
- `ColorPicker`: a press in the area still picks a color when the browser refuses pointer capture, instead of throwing. The thumb's focus ring comes from a sibling selector rather than `:has()`, so Safari has it in place when a scroll container brings the ring into view.
- `ChipList`: the +N panel stays on screen when neither its start nor its end can line up with +N.
- A Popover or Menu whose anchor went away as it closed, such as the mention list after a pick, now goes at once in Firefox and Safari, as it does in Chrome.
- A picker that fails the browser's own check outside a `Form.Root` takes the focus in Safari too, instead of leaving it in the hidden date input.
- A focus ring that a scroll container brings into view is no longer cut by a pixel in Safari.
- A Tooltip in a right-to-left page sits by its trigger in Firefox when the trigger is in a Drawer.
- Toasts start timing again in Firefox when the toast under a resting pointer is removed.
