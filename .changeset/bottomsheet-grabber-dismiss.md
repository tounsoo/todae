---
"@tounsoo/todae": minor
---

BottomSheet comes back to its snap height when the owner turns down a drag-to-dismiss, instead of staying open with no height while the page stays blocked, and its grabber now resizes the sheet on a press, so screen reader, switch and touch users can change its height too.

- A press on `BottomSheet.Grabber` toggles between `mid` and `full`, and the button reports `aria-expanded` (true at `full`). Tests that click the grabber and expect nothing to change need updating.
- With a single entry in `snapPoints`, the grabber is a decorative mark, not a focusable button, so it is no longer the sheet's first tab stop and ArrowDown on it no longer closes a `mid`-only sheet. Escape, the backdrop and `BottomSheet.Close` still close it.
- `onSnapChange` no longer fires when the snap doesn't change, such as ArrowUp on a sheet already at `full`.
- A drag-dismiss the owner accepts now slides off from where the drag let go, and a drag that ends on the grabber or a close part in the header no longer also presses it.
