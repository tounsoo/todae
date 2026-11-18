---
'@tounsoo/todae': minor
---

useLaneDrag can drag out a new place on empty lane space when you pass onCreate.

- `useLaneDragState` reads `LaneDragChange | LaneCreateDrag | null`. A create is `{ kind: 'create', id: null, from: null, to, verdict: null }`. `onDrop` still receives only `LaneDragChange`. A switch over every kind, or code that reads `state.id` as a string, has to handle the create, where `id` is null.
- A press on `[role="button"]` or a tab stop (`tabindex` of 0 or more) inside an item's handle does not start a move. Those controls keep the press.
