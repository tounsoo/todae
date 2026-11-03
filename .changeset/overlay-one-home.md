---
'@tounsoo/todae': minor
---

usePopover takes an `anchorName` option that places the popover at a CSS anchor other than its trigger, such as useMentions' `caretPeekAnchorName`, and a modal now recognizes a moved-in layer by `data-todae-guest-layer`.

- Toast.Region's host now carries `data-todae-guest-layer` instead of `data-todae-toast-host`; update any selector that targets the old attribute.
- To show a peek at the caret's mention, pass `anchorName: useMentions().caretPeekAnchorName` to `usePopover`. Both are new, so there is nothing to migrate.
