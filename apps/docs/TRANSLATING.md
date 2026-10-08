# Translating the docs

The docs are written in English and translated into Korean (한국어). Translations are welcome, one page at a time.

## How the site is laid out

- English is the default. Its pages live in `app/(en)/` and have no URL prefix, so `app/(en)/button/page.mdx` is `/button`.
- Every other language has a folder named after its locale. Korean pages live in `app/ko/` under `/ko`, so a Korean `app/ko/button/page.mdx` is `/ko/button`.
- A page with no translation still has a URL in every language. `/ko/button` shows the English page, marked `lang="en"`, under a notice that links here. `app/ko/[...slug]/page.tsx` does this for every page listed in `lib/i18n/englishPages.ts`.
- The site's own words (sidebar sections, link text, the language switcher, the notice, the playground's controls, props table headings) live in `lib/i18n/dictionaries.ts`. Prop descriptions live in `lib/i18n/props/`. Component and hook names, such as `Button` or `useField`, stay as they are in code.

## Translate a page

1. Copy the English page to the same path under the locale folder. For the Button page in Korean, copy `app/(en)/button/page.mdx` to `app/ko/button/page.mdx`. The locale folder sits beside `(en)`, so relative imports such as `../../../components/demos/ButtonDemo` stay the same.
2. Translate the prose and headings. Keep these as they are:
   - Code blocks and inline code.
   - Component, prop, hook and token names.
   - JSX such as `<Example>` and `<PropsTable name="…" />`. Translate only the text you pass to them.
   - Links to other docs pages, such as `[Tokens](/tokens)`. Write the English path; on a Korean page it goes to `/ko/tokens` by itself.
3. Run `pnpm dev:docs` and open the page under `/ko`. The "not translated yet" notice should be gone.
4. Run `pnpm --filter docs test` and open a pull request. One page per pull request is easiest to review.

A translation does not change when its English page does. When you change an English page that has translations, say so in the pull request so a translator can catch up.

### Korean style

- Write in the polite declarative form (합니다체), as the translated pages do.
- Keep component and pattern names in English, in titles too: a Korean recipe is still `Combobox`, and the `ChipList` page keeps its title.
- Keep other terms readers search for in English, such as `props`, `ref` and DTCG, or give the English term in parentheses the first time.
- Keep sentences short and direct, as the English pages are.

## Translate the site's own words

Edit the locale's entry in `lib/i18n/dictionaries.ts`. Every string is required except `groups` and `links`, which fall back to the English names in `components/siteGroups.ts`. TypeScript reports a missing string.

## Translate prop descriptions

Props tables come from the design system's JSDoc, in English. Their translations live in `lib/i18n/props/<locale>.json`, by component and prop. Each entry keeps the English it was translated from:

```json
"Button.Root": {
  "variant": {
    "en": "Visual style. Non-primary sets data-button-variant.",
    "ko": "시각 스타일. primary가 아니면 data-button-variant를 설정합니다."
  }
}
```

A test fails when a prop a page shows has no translation, or when its English has changed since it was translated, so every prop stays translated. When you change a prop's JSDoc in `packages/design-system`, run `pnpm schema` and update each locale's entry in the same pull request: copy the new English to `en` and fix the translation. (An entry that is somehow out of date shows the current English, never an outdated translation.)

## Add a language

1. Add the locale to `LOCALES` and its name, written in that language, to `LOCALE_NAMES` in `lib/i18n/config.ts`.
2. Add its dictionary to `DICTIONARIES` in `lib/i18n/dictionaries.ts`, and its prop descriptions to `PROP_TRANSLATIONS` in `lib/i18n/propDescriptions.ts`. The tests require every prop a page shows to be translated, so translate them all in the same pull request (copy `lib/i18n/props/ko.json` and replace each `ko` with the new locale).
3. Copy `app/ko/layout.tsx`, `app/ko/page.tsx` and `app/ko/[...slug]/page.tsx` into `app/<locale>/`, and change `ko` to the new locale in each.
4. Add `/<locale>` to `LOCALE_PREFIXES` in `next.config.mjs`, so old URLs redirect in the new language too.
5. Run `pnpm --filter docs test` and `pnpm build`.

## Add an English page

List its slug in `lib/i18n/englishPages.ts` as well as in `components/siteGroups.ts`. A test fails until both list it, so every language can show the page before anyone translates it.
