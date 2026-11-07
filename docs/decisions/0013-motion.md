# 0013. Motion comes from role and component tokens

- **Date:** 2026-11-07
- **Status:** Active
- **Source:** [ARCHITECTURE.md, Motion](../../ARCHITECTURE.md#platform), and the pull requests named below.

## Decision

Every animation reads its timing and curve from tokens. The rules, and the reason for each choice, are in the Motion entry of [ARCHITECTURE.md](../../ARCHITECTURE.md#platform); this record only lists the dated decisions and where they landed.

- **2026-11-03:** the core enter and exit curves; a scale and rise for Dialog, Popover and Menu; the `selection` and `tabs` motion tokens.
- **2026-11-04:** slower Popover, Menu and Dialog timings; the five motion roles (`motion.reveal`, `popup`, `window`, `panel`, `notice`); Popover moving by attributes.
- **2026-11-05:** the Mention popups fade out; Coachmark's `move` pair.
- **2026-11-07:** the motion review's changes, in pull requests 401 (reduced motion), 404 (height changes), 399 (Tooltip), 402 (hover fades), 400 (Progress, Meter, Alert and ErrorMessage) and 403 (Conversation); the overlay curves folded into the core curves, `toast.motion.offset` and Coachmark's own popup timing (410); the caret's `field.code.caret.motion.duration`, `conversation.motion.duration.glide`, and Skeleton keeping its own pulse curve (this pull request).

## Why

The 1.0 gap review asked for one enter and exit shape and a real exit curve, and tokens let a theme retime every component of one role, or one component, in one place.
