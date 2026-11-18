---
'@tounsoo/todae': minor
---

useLaneDrag can drag out a new place on empty lane space when you pass onCreate.

- `useLaneDragState` reads `LaneDragChange | LaneCreateDrag | null`. A create is `{ kind: 'create', id: null, from: null, to, verdict: null }`. `onDrop` still receives only `LaneDragChange`.
