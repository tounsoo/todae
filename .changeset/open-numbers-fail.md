---
"@tounsoo/todae": patch
---

Dialog and Drawer now focus `initialFocusRef` when opened after mount. With no `initialFocusRef`, overlays skip controls with a negative tabindex, hidden ones and ones a stylesheet hides, and can now land on an iframe, an audio or video player with controls, or a contenteditable. Tooltip's text-only and links-only warnings in development flag those too, including for an interactive tooltip that mounts closed. ScrollArea takes its own tab stop when every control inside is hidden, and updates when one is hidden or shown later. A slow BottomSheet drag all the way down now dismisses it.
