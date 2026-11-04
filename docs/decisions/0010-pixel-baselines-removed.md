# 0010. The pixel screenshot baselines are removed

- **Date:** 2026-11-04
- **Status:** Active
- **Source:** Ben's plan decision of 2026-11-02 to remove all 444 pixel baselines once the style matrix, axe and painted-color APCA checks are green, with no pixel backstop, and his go-ahead on 2026-11-04 after axe and contrast checks reached every overlay and picker (PR 348).

## Decision

Todae has no pixel screenshot tests. The 444 baselines in `apps/docs/visual/baselines`, the example and page shots, the `test:visual:docker` script, the CI screenshot artifact and the `ShotNudge` spacer that kept avatar demos on their baseline pixels are gone. The browser tests' computed-style checks, axe and the painted-color APCA checks guard how components look, in light and dark.

The Korean pages keep their axe run: `pnpm --filter docs test:axe` runs axe over the built Korean home, Button and playground pages in light and dark at desktop and phone width, in the Docs job. Any PNG added or edited now fails the Forbidden paths job.

## Why

The decision gives no reason beyond its condition: once the style, axe and APCA checks are green, the pixel diffs go, with no backstop. PR 348 met that condition.
