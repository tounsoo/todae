---
extends:
when: Changing, adding or translating a docs page under apps/docs on todae.
---

### Docs translation

The docs site is in English and Korean, and Korean is kept complete. `apps/docs/TRANSLATING.md` has the full rules. These steps are the part every docs change needs.

1. A change to an English `page.mdx` in `apps/docs/app/(en)` also changes its Korean twin in `apps/docs/app/ko`, in the same pull request. A new English page adds its Korean page in that pull request too, and lists its slug in both `apps/docs/lib/i18n/englishPages.ts` and `apps/docs/components/siteGroups.ts`.
2. Update the Korean sections that the English change touched, with the same headings and blocks as the English. Write in the polite declarative form (합니다체), and keep component, prop, hook and token names in English.
3. Once the Korean says what the English now says, run `pnpm --filter docs i18n:stamp ko <slug>` and commit the change it makes to `apps/docs/lib/i18n/sources/ko.json`. A stamp records only the English, so never stamp just to make the test pass.
4. A changed prop JSDoc in `packages/design-system` runs `pnpm schema`, then updates that prop's `en` and `ko` entries in `apps/docs/lib/i18n/props/ko.json` in the same pull request.
5. Run `pnpm --filter docs test` before the pull request opens.
