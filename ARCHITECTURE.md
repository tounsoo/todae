# Todae architecture and decisions

Read this before adding a component, hook, recipe, token or docs page. It records what Todae has decided and why, so new work lands the same way.

These are rules for new and changed code. Some older code predates a rule and does not follow it yet. Don't copy an exception into new code; bring old code in line when you are already changing it.

The docs site explains the same ideas to people who use Todae: [Composition](apps/docs/app/(en)/composition/page.mdx), [Build on Todae](apps/docs/app/(en)/guides/build-on-todae/page.mdx), [CSS layers](apps/docs/app/(en)/guides/css-layers/page.mdx), [Tokens](apps/docs/app/(en)/tokens/page.mdx) and [Native platform](apps/docs/app/(en)/platform/page.mdx). This file is for the people and agents who change Todae. When a decision here changes, update this file in the same pull request.

## What Todae is

Todae is a low-level base that companies build their own design systems on. A company adds a token package, a few TypeScript declarations and thin wrappers around Todae's parts, without forking Todae.

So choices favor what a company can extend or restyle without copying Todae's code: tokens over hard-coded values, parts over monoliths, native elements over JavaScript reimplementations, and no product knowledge in the package.

## Kinds of exports

What Todae ships is a component, a hook or a recipe. Providers, their hooks, and helpers such as `composeRefs` and `categoryTone` sit outside the split.

- **Component.** Todae can fix its markup, props and behavior without knowing the product's data, fetching, routing, business rules or screen layout. It may own behavior (Menu, Tabs) or only styles from tokens (Stack, Text).
- **Hook.** Behavior with no markup, exported when a recipe or a product's own markup needs it, such as `useRovingFocus` and `useCombobox`.
- **Recipe.** Copyable code in the docs that puts exports together around product data or flow, such as Combobox and File upload. It is not a package export.

Rules:

- **Anything that carries Todae tokens or styles is an exported component**, even when the browser does all the behavior. Link, Table, Separator and VisuallyHidden, for example, are `*.Root` components for this reason. Don't style bare elements in `todae.base`. *Why:* every Todae look should come from an export a company can find, wrap and restyle.
- **A recipe is thin glue.** Keyboard handling, focus management, ARIA wiring, measurement and positioning go in a component or hook, so a company can copy a recipe and restyle it without breaking accessibility. If copied recipe code would still carry hard behavior, move that behavior into Todae.
- **A container that gives context or keyboard handling to whatever children it holds is a component** (Fieldset shares `disabled` and `invalid`; Toolbar gives roving focus). **A composition that wires specific exports to each other is a recipe** (Combobox connects a Field to an OptionList).
- **Don't ship a wrapper with no behavior, styles or tokens of its own.** If the arrangement is worth showing, write a recipe.
- **Don't add a headless hook that only mirrors a component.** `useTabs` and `useMenu` were dropped because the thin native parts plus `useRovingFocus` cover custom markup.
- **No icon component and no icon set.** Components take icons as children or slots (`Button.Icon`, `Alert.Icon`). Todae draws the few glyphs a part needs to look whole, such as a close cross or a check, and `GlyphsProvider` swaps them for any library's icons. There is no global icon size scale; give a new icon slot its own `icon.size` token.

## Component API

- **Compound namespaces.** A component with parts is a namespace object with a `Root`: `Menu.Root`, `Menu.Item`, `Table.HeaderCell`. Components without parts exist in both shapes today: a `{ Root }` namespace (`Separator.Root`) or one export (`Stack`).
- **Don't nest namespaces** (no `Field.Button.Root`), and give each root one interactive role. Components sit side by side: a Field and a Popover are siblings, neither wraps the other.
- **A part that renders an element forwards native attributes and its ref.** Type its props with `ComponentPropsWithRef<'element'>`, spread the rest onto the element, and merge `className` with `cx`. *Why:* a company wrapper only has to spread props to keep everything working.
- **Don't make behavior depend on a child's component type.** Parts register through context, or a parent looks for a data attribute the child renders. *Why:* a company's wrapped `OptionList.Option` or `Button.Icon` must still work.
- **Routers plug in through a `render` prop** (`Link.Root`), not an `as` prop or a router dependency.
- **Text Todae writes by itself**, such as a close button's default name, comes from `StringsProvider` (`useStrings()`), not a hard-coded English string. A server entry, which can't read context, uses `DEFAULT_STRINGS`.
- **Glyphs** are read from `GlyphsProvider`. Put glyph state (hidden, rotated, mirrored) on the `[data-todae-glyph]` wrapper span, not on the `svg`, so a swapped-in icon follows it.
- **Server entries.** A component that a Server Component should render directly gets a server-safe entry: `src/server/<slug>.ts`, an entry in `vite.config.ts`, and an `exports` entry in `package.json` as `@omsoo/todae/<slug>`. Where the component reads a client provider, the client version is a `*.client.tsx` wrapper exported from the root entry.
- **Keep `'use client'` out of component and hook files.** It sits in `src/index.ts` and the provider files. `src/entries.test.ts` checks that a server entry's import closure has no `'use client'`, hooks, `createContext` or CSS import, so helpers a server entry needs stay hook-free in their own files (`cx.ts`, `tone.ts`).

The rules below were read from the code rather than decided in a thread. Follow them unless there is a reason not to.

- **Controlled state comes in triples:** `value`/`defaultValue`/`onValueChange`, and the same for `open`, `checked` and `pressed`, built on `useControlledState` or `useControlledValue`. The callback gets the new value, not an event, and `undefined` means uncontrolled.
- **`onOpenChange(open, reason)`** passes a typed reason, such as `'escape'`, `'backdrop'` or `'close-button'`, so a product can tell why an overlay closed.
- **Names.** Props types are `<Component><Part>Props` (`BadgeRootProps`). Union prop types are exported as `<Component><Prop>` (`AlertTone`, `ButtonVariant`). Form state is `disabled` and `invalid`, not `isDisabled` or `error`. Overlays take `dismissOnEscape`, `dismissOnBackdrop`, `initialFocusRef` and `restoreFocusRef`.
- **Read Fieldset state** through `useFieldsetState`: `disabled` is OR-ed with the nearest Fieldset, and a control's own `invalid` wins over the Fieldset's.
- **Run the consumer's handler first** with `composeHandlers(theirs, ours)`, which skips Todae's behavior when the consumer calls `preventDefault()`.
- **A part rendered outside its Root throws.** Misuse that can still render (an icon-only button with no name, both `checked` and `defaultChecked`) logs a development-only `console.error` or `console.warn` behind `process.env.NODE_ENV !== 'production'`.
- **State reaches CSS through `data-*` attributes.** Boolean state is an empty attribute, left off when false (`data-selected`, `data-disabled`); enum state is its value (`data-tone`, `data-size`, `data-orientation`). Name an attribute that other Todae code looks up `data-todae-*` (`data-todae-glyph`, `data-todae-roving`).
- **Items inside an ARIA widget** (options, menu items) take `aria-disabled` and stay focusable, as the ARIA patterns expect; standalone native controls take `disabled`.

## Hooks

- **Prefer one options object in and one result object out,** typed `Use<Name>Options` and `Use<Name>Result`, for hooks that drive markup.
- **Prop getters** are named `get<Element>Props` (`getTriggerProps`, `getListboxProps`). A getter that takes the caller's props merges them and composes the caller's ref.
- **A hook that creates ids** accepts an optional `id` and returns them as `ids`, so a recipe can wire labels by hand. Ids that end up in a CSS selector or ident go through `useDomId()`.

## Tokens

- **Follow DTCG 2025.10.** Aliases are JSON Pointer `$ref`s (`{ "$ref": "#/color/gray/900/$value" }`); the build rejects curly-brace aliases. *Why:* companies should be able to use standard DTCG tools on Todae's tokens.
- **Four layers, lowest first:** `core` (raw scales), `appearance` (light and dark semantics), `density` (spacing per density) and `contract` (what components read; button variants are a contract modifier). A token references a lower layer, or a token in its own set or modifier context, and the build checks this along with `resolutionOrder` in `tokens/resolver.json`.
- **Give a new component contract tokens and have its CSS read them.** Put them in a file in `packages/design-system/tokens/components/` and add that file to the contract set's `sources` in `tokens/resolver.json`; the build ignores a file that isn't listed. Point color tokens at semantic `appearance` tokens. *Why:* a rebrand changes the appearance layer and every component follows.
- **Component token names** are `<component>`, then an optional part, the property, and an optional state (`chip.bg.hover`, `separator.color`). Reuse the state names that exist, such as `default`, `hover`, `active`, `focus`, `disabled`, `invalid`, `selected` and `checked`. Required state sets can be declared as `slots` in `tokens/resolver.json`, and the build checks them.
- **Translucent colors take `alpha` from the `opacity` scale** with a `$ref`, not a literal. `color.bg.transparent` keeps a literal 0 on purpose.
- **Contrast is APCA (Lc), not WCAG 2 ratios.** Text pairs and their minimums live in `$extensions["dev.todae"].contrast` in `tokens/resolver.json`, and the build fails a pair that falls short. A company's tokens are checked against the same pairs.
- **The accent is neutral ink, not a hue.** Don't introduce a blue accent; a build test lets only `color.category` read the blue scale.
- **Tones.** Status tones are `info`, `success`, `warning`, `critical`. Category tones are numbered `category-1` to `category-8`, not named after hues, so a company can re-hue without renaming. Avatar takes neutral and category tones, not status tones. `categoryTone(key)` hashes a string to a tone; keep its pinned test values, since changing the hash changes every user's color.
- **Generated files are committed.** Run `pnpm tokens` after editing token files; `pnpm tokens:check` fails on drift.
- **Extensibility comes first.** Companies add sets, contexts, variants and densities in their own resolver and build them with `todae-tokens build`. New token features should work through that path, not by editing Todae's files.

## CSS

- **Todae's CSS sits in one cascade layer, `todae`.** `src/styles/layers.css` declares `todae.reset` (empty), `todae.base` (tokens and the modal scroll lock) and `todae.components`, and is imported first by every build entry. A company's token build adds `todae.theme` after them. *Why:* a company places Todae with one name, and its own CSS wins by layer order, not specificity.
- **Component styles are CSS Modules** in `@layer todae.components`. Components that style a single native element (Link, Table, Code and similar) use the `todae.components.native` sublayer, so container components such as Pagination beat them.
- **Take colors, spacing, radii and sizes from tokens** through their `--todae-*` custom properties rather than literals. Restyling goes through tokens first; a class works for layout.
- **Classes are camelCase**, and a part's main class is usually `.root`. Name a custom property a sheet sets for its own arithmetic `--_<name>` (`--_ring-room`), so it doesn't look like a token.
- **Use logical properties** (`inline`, `block`) for layout, and `:dir(rtl)` for anything that must flip.
- **Some rules are tested.** `src/styles/tokenConsistency.test.ts` requires outlines to use the focus ring tokens, keeps `opacity` off disabled styles, checks tone rules for the components it lists, and limits which tokens each sheet reads. Other tests ban scrollbar styling and a `transform` on an element that may contain a tooltip trigger.
- **Forced colors.** Where a state shows only through fill (pressed, selected, checked, current), add an `@media (forced-colors: active)` rule that maps it to system colors.
- **Use `!important` only for rules that must hold**, such as `VisuallyHidden.Root` and hidden tab panels.
- **Wrap hand-written selectors in `todae.base` in `:where()`,** so any class a company adds wins.

## Platform

- **Use the best native HTML and CSS features, with no JavaScript fallbacks and no support matrix.** The feature list is on the [Native platform](apps/docs/app/(en)/platform/page.mdx) page; add a feature there when a component starts to depend on it. *Why:* Todae stays small and gets better as browsers do.
- **Overlays.** `Dialog` and `BottomSheet` render in place on a modal `<dialog>` (no portal), so they inherit the theme. `Popover`, `Menu` and `Tooltip` use `popover="manual"` with CSS anchor positioning. Page scroll stops through `:root:has(dialog:modal)` in CSS, not a scroll-lock hook.
- **Toast** holds text and buttons, no nested menus or dialogs. Its region follows Todae's modal stack into the front modal; a product's own modal `<dialog>` joins that stack through `useModalLayer`.
- **Motion** reads the motion tokens (`motion.duration.*`, `motion.easing.*`), respects `prefers-reduced-motion`, and only has to work in Chrome. Don't add workarounds for Safari motion gaps.

## Accessibility

- **Follow the ARIA Authoring Practices pattern** for each interactive component, and keep that behavior in the component or a hook, not in a recipe.
- **Toolbar keeps its no-tabindex design:** Tab is steered to the edge of a run instead of managed `tabindex`. This was chosen knowing its limits (an ancestor that cancels Tab after the hop, an item that stops Tab propagating, Safari skipping buttons by default); don't switch back.
- **axe runs over the docs demos in a real browser**, with color contrast off, since contrast is APCA in the token build.

## Tests

- Unit tests sit next to the code as `*.test.ts(x)` and run in jsdom.
- Behavior that needs real layout, focus or the top layer goes in `src/browser/*.browser.test.tsx`, which runs in Chromium through Playwright (`pnpm test:browser`).
- Add each new part to `src/components/parts.test.tsx`, which checks that parts forward native attributes and their ref.
- `src/components/overlay.parity.test.tsx` holds Dialog, Drawer and BottomSheet to one contract (labelled, initial focus, Escape, backdrop reason, focus restore, named close button). A new modal overlay should join it.
- Keep one copy of a check: when jsdom and a browser test cover the same behavior, keep the browser one only if jsdom can't model it.
- Docs tests import the built package, so run `pnpm build:ds` before `pnpm test` in a fresh checkout.

## Docs

Each component, hook and recipe gets a page in `apps/docs/app/(en)` and a Korean twin in `apps/docs/app/ko`, changed in the same pull request (see [`CLAUDE.md`](CLAUDE.md) and [`apps/docs/TRANSLATING.md`](apps/docs/TRANSLATING.md)).

- **Page shape for a component or hook:** a short intro with a live `<Example>` and code, any topic sections, then `## Accessible composition` (**Todae handles:** / **You supply:** / **Watch for:**), `## When to use` (**When:** / **When not:**), and `## Props`. The docs MCP server reads "When to use".
- **Prop descriptions** live in each part's `*.meta.ts` and reach the props table through `pnpm schema`. When one changes, update its Korean entry in `apps/docs/lib/i18n/props/ko.json`.
- **Tables are JSX** with `Table` parts. The docs MDX has no GFM, so pipe tables render as plain text.
- **Write narrow claims.** Absolute words such as "only", "never" and "always" are the claims reviews most often find wrong. State what the code does and stop.

## Recording a decision

When the project settles a question about concepts, API shape, tokens, CSS or platform use, add it to the section it belongs to here: the rule, then why. Remove a rule that a later decision replaces instead of keeping both.
