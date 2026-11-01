# 0005. Catalog pages for components, utilities and recipes

- **Date:** 2026-11-01
- **Status:** Active
- **Source:** Ben, approved 2026-11-01. Landing-page option A.

## Decision

The docs site has a catalog page for Components, Utilities and Recipes, in English and Korean. The header lists all three, in both languages. On a wide screen they sit in the top bar. The English labels plus the tools need about 60rem, so below that the top bar hides the row and the same links are in the menu the header already opens. The current catalog carries `aria-current="page"`. The home page lists stay as they are. The utilities and recipes catalogs are not linked from the home page.

This ships as two pull requests. The first adds the catalog pages and the header link. The second adds a featured set on the home page. That set waits for Ben's approval and is not part of this change.

## Why

Option A lists every item in the section from the same groups as the sidebar. Splitting the home page out leaves those lists unchanged until the featured set is approved.

The narrow header already opens a menu instead of keeping the top-bar links on screen. The catalogs use that menu. A second mobile navigation was not added.

The home page has five sections. Two tracks always leave the last card, Tools, alone. That card spans the row while the grid is two tracks wide. A one-track or three-track layout through that range would either stack every section or squeeze the cards under 20rem. Flex wrap would also make the cards on the last row a different width from the rows above.
