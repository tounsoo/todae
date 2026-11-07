# 0013. Motion comes from role and component tokens

- **Date:** 2026-11-07
- **Status:** Active
- **Source:** [ARCHITECTURE.md, Motion](../../ARCHITECTURE.md#platform), and the pull requests named below.

## Decision

Every animation reads its timing and curve from tokens. The rules, the roles and which component reads what are in the Motion entry of [ARCHITECTURE.md](../../ARCHITECTURE.md#platform); this record dates the choices behind them.

- **2026-11-03.** Ben chose the gentle accelerating exit curve (`0.4, 0, 1, 1`), with the settling enter curve (`0.2, 0.8, 0.2, 1`), and a scale and rise for Dialog, Popover and Menu. He approved the `selection` and `tabs` motion tokens as proposed.
- **2026-11-04.** After watching them, Ben slowed Popover and Menu to 240ms in and 200ms out and Dialog to 280ms in and 200ms out, two core steps slower. He asked for the full set of motion roles (`motion.reveal`, `popup`, `window`, `panel` and `notice`) rather than one shared pair. Popover moves by attributes, as Drawer does, because Safari on iOS has no `overlay` transition; it returns to `@starting-style` once Safari supports it.
- **2026-11-05.** Ben asked for the Mention suggestion list and caret peek to fade out like the other popovers, and approved Coachmark's `move` pair so a tour's next step slides.
- **2026-11-07.** A motion review of every component led to these changes: under reduced motion, fades keep their tokens while nothing slides, scales or rises (pull request 401); Disclosure, a Nav branch and a listed toast change height as they open, close and leave, while Tree's groups still open at once (404); Tooltip fades in only when it opens cold (399); Button, Chip, Link and Pagination fade their hover colors with `control.motion.*` (402).

## Why

The 1.0 gap review asked for one enter and exit shape and a real exit curve. Tokens let a theme retime every component of one role, or one component, in one place. The reason for each later choice is in the Motion entry of ARCHITECTURE.md.
