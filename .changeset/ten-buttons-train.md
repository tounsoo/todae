---
"@tounsoo/todae": minor
---

Move Button's token shape into `tokens/resolver.json` as `slots` and cut `@tounsoo/todae/tokens-builder` down to what a company build needs.

- `@tounsoo/todae/tokens-builder` now exports only `buildCompanyTokens`, `cli`, `contrastResults`, `apcaContrast`, `oklchToSrgb`, `resolveEntries`, `parseScope` and the resolver types (`ContrastPair`, `ContrastResult`, `CompanyTokensResult`, `EntryToken`, `FlatToken`, `Layer`, `ResolvedEntry`, `Rule`, `SlotRules`, `TodaeExtension`, `TokenEntry`, `TokenRef`). Import nothing else from it; the build internals, such as `validatePaintPacks`, `emitCss`, `loadResolver` and `buildTokensGraph`, are gone.
- The `button` value of `$extensions["dev.todae"].rules` is gone, and a resolver that lists it fails. Delete `"rules": ["button"]` from your `buttonVariant` and `button` entries; they keep Todae's button `slots`, so the build still checks a variant's shape.
- A `slots` group now lists every child its group may have, subgroups included, so a token in a subgroup the slot doesn't list fails the build. Add the subgroup's name to the slot's list, or declare its own slot group for it.
