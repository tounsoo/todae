---
'@tounsoo/todae': minor
---

usePopover takes an `anchorName` option that places the popover at a CSS anchor other than its trigger, such as useMentions' `caretPeekAnchorName`, and a modal now recognizes a moved-in layer by `data-todae-guest-layer`.

- Toast.Region's host now carries `data-todae-guest-layer` instead of `data-todae-toast-host`; update any selector that targets the old attribute.
- A peek at the caret's mention passes `anchorName: caretPeekAnchorName` to `usePopover` instead of setting `positionAnchor` and `--todae-popover-anchor` on the popover's style.
