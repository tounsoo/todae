---
"@tounsoo/todae": patch
---

Dialog, Drawer and BottomSheet now focus `initialFocusRef` when opened after mount. With no `initialFocusRef`, overlays now skip controls with a `tabindex` below -1, hidden inputs (`input[type=hidden]`), controls a stylesheet or a closed `<details>` hides, and controls under `aria-hidden="true"`. They can now land on an iframe, an audio or video player with controls, or a contenteditable. Tooltip's text-only and links-only warnings in development flag those too. ScrollArea and Conversation.Viewport take their own tab stop when every control inside the area is hidden, and update when one inside is hidden or shown later. Toolbar's arrow keys now skip a control under `aria-hidden="true"`. A slow BottomSheet drag all the way down now dismisses it.
