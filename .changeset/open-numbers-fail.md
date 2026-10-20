---
"@tounsoo/todae": patch
---

Dialog, Drawer and BottomSheet now focus `initialFocusRef` when opened after mount, and a slow BottomSheet drag all the way down now dismisses it. Without `initialFocusRef`, overlays now skip controls with a negative `tabindex`, hidden inputs, controls hidden by a stylesheet or a closed `<details>`, and controls under `aria-hidden="true"`, and they can land on an iframe, a media player with controls, or a contenteditable. They no longer skip the controls inside a non-form element that carries `disabled`, such as a `div`, since that never disabled anything; they still skip a disabled form control or the controls of a disabled fieldset. Tooltip's development warnings for text-only and links-only content now flag every control inside that is not disabled, even one that is hidden or has a negative `tabindex`.
