---
"@tounsoo/todae": patch
---

Dialog, Drawer and BottomSheet now focus `initialFocusRef` when opened after mount, and a slow BottomSheet drag all the way down now dismisses it. Without `initialFocusRef`, overlays now skip controls with a negative `tabindex`, hidden inputs, controls hidden by a stylesheet or a closed `<details>`, and controls under `aria-hidden="true"`, and they can land on an iframe, a media player with controls, or a contenteditable. A `disabled` attribute on a wrapper such as a `div` no longer disables the controls inside; a disabled form control or fieldset still does. Tooltip's development warnings for text-only and links-only content follow the same rules.
