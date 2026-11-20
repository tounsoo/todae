# 0017. The base theme ships a critical Button variant

- **Date:** 2026-11-20
- **Status:** Active
- **Source:** Ben, 2026-11-20.

## Decision

`Button.Root` ships `variant="critical"` in the base theme, beside `primary`, `secondary` and `ghost`. The variant is a `buttonVariant` context. Its colors are new `button.critical.*` tokens that reference `color.danger.default`, `color.status.critical.*`, `color.on-accent` and `focus.ring`. Companies still add a variant by augmenting `ButtonVariants` and declaring a `buttonVariant` context.

Use `critical` for the irreversible action in a confirm dialog. A promise-based `confirm()` and which action is critical stay with the product.

## Why

The base theme had no shared look for an irreversible confirm, so each product invented one. The danger and status critical scales were already in the theme. Pointing the button at those tokens lets a company that retints danger or critical retint the button with them.

`on-accent` text meets WCAG AA, 4.5 to 1, on `color.danger.default` and on `color.status.critical.fg` in light and dark. Those two fills are the resting and hover colors. The press keeps the hover fill and switches the text to `color.status.critical.bg`, which also meets 4.5 to 1 in both schemes. The status scale has no third fill that keeps `on-accent` text at 4.5 to 1 in both schemes. Disabled uses the status critical text on the status critical background, which meets 4.5 to 1. The placeholder gray used by the other variants does not.
