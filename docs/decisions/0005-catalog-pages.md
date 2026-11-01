# 0005. Catalog pages and a featured home set for components, utilities and recipes

- **Date:** 2026-11-01
- **Status:** Active
- **Source:** Ben, approved 2026-11-01. Landing-page option A, and the featured home set.

## Decision

The docs site has a catalog page for Components, Utilities and Recipes, in English and Korean. The header Components link opens `/components`, and `/ko/components` in Korean.

The home page features eight items for each of Components, Utilities and Recipes, in a fixed order, then links to that catalog. The link text is `See all {count}` in English and `전체 {count}개 보기` in Korean. The count is the group's length, the same number the section's badge shows. Components shows 57, the same list the catalog uses for its top-level rows. Field's sub-pages are on that catalog, nested under Field, and are not counted again. Foundations and Tools stay whole and have no catalog link.

## Why

Option A lists every item in the section from the same groups as the sidebar. A home page that shows all 57 components and 26 utilities is long and hard to scan, so it shows a short featured set and sends the reader to the catalog for the rest. Ben approved the featured set on 2026-11-01. Using one count for the badge and the link keeps a card from showing two different numbers.
