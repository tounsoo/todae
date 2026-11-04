# 0010. The pixel screenshot baselines are removed

- **Date:** 2026-11-04
- **Status:** Active
- **Source:** Ben's plan decision of 2026-11-02 to remove all 444 pixel baselines once the style matrix, axe and painted-color APCA checks are green, with no pixel backstop, and his go-ahead on 2026-11-04 after axe and contrast checks reached every overlay and picker (PR 348).

## Decision

Todae has no pixel screenshot tests. The 444 baselines in `apps/docs/visual/baselines`, the example and page shots, the `test:visual:docker` script, the CI screenshot artifact and the `ShotNudge` spacer that kept avatar demos on their baseline pixels are gone. The browser tests' computed-style checks, axe and the painted-color APCA checks guard how components look, in light and dark.

The Korean pages keep their axe run: `pnpm --filter docs test:axe` runs axe over the built Korean home, Button and playground pages in light and dark at desktop and phone width, in the Docs job. The same run still loads every built English page with an example and fails one that doesn't hydrate or never stops changing. Any PNG added or edited now fails the Forbidden paths job.

## Why

Once axe and the contrast checks covered every overlay and picker in both themes (PR 348), Ben chose those checks over pixel diffs, with no pixel backstop. The record gives no other reason.
