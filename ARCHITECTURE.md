# Todae architecture and decisions

Read this before adding a component, hook, recipe, token or docs page. It records what Todae has decided and why, so new work lands the same way as what is already there. Each section gives the rule first, then the reason.

The docs site explains the same ideas to people who use Todae: [Composition](apps/docs/app/(en)/composition/page.mdx), [Build on Todae](apps/docs/app/(en)/guides/build-on-todae/page.mdx), [CSS layers](apps/docs/app/(en)/guides/css-layers/page.mdx), [Tokens](apps/docs/app/(en)/tokens/page.mdx) and [Native platform](apps/docs/app/(en)/platform/page.mdx). This file is for the people and agents who change Todae. When a decision here changes, update this file in the same pull request.

## What Todae is

Todae is a low-level base that companies build their own design systems on. A company adds a token package, a few TypeScript declarations and thin wrappers around Todae's parts. It never forks Todae.

So every choice favors what a company can extend or restyle without copying Todae's code: tokens over hard-coded values, parts over monoliths, native elements over JavaScript reimplementations, and no product knowledge in the package.

## Kinds of exports

Everything Todae ships is a component, a hook or a recipe. Providers, their hooks, and helpers such as `composeRefs` and `categoryTone` sit outside the split.

- **Component.** Todae can fix its markup, props and behavior without knowing the product's data, fetching, routing, business rules or screen layout. It may own behavior (Menu, Tabs) or only styles from tokens (Stack, Text).
- **Hook.** Behavior with no markup, exported when a recipe or a product's own markup needs it, such as `useRovingFocus` and `useCombobox`.
- **Recipe.** Copyable code in the docs that puts exports together around product data or flow, such as Combobox and File upload. It is never a package export.

Rules:

- **Anything that carries Todae tokens or styles is an exported component**, even when the browser does all the behavior. Link, Disclosure, Separator, Table, Progress, Meter, Spinner, Skeleton, Slider, Code, Kbd and VisuallyHidden are `*.Root` components for this reason. `todae.base` styles no bare element, so a plain `<a>` or `<table>` gets no Todae look. *Why:* every Todae look should come from an export a company can find, wrap and restyle.
- **A recipe is thin glue.** Keyboard handling, focus management, ARIA wiring, measurement and positioning live in a component or hook, so a company can copy a recipe and restyle it without breaking accessibility. If copied recipe code would still carry hard behavior, move that behavior into Todae.
- **A container that gives context or keyboard handling to whatever children it holds is a component** (Fieldset shares `disabled` and `invalid`; Toolbar gives roving focus). **A composition that wires specific exports to each other is a recipe** (Combobox connects a Field to an OptionList).
- **A wrapper with no behavior, styles or tokens of its own is never a component.** If the arrangement is worth showing, write a recipe.
- **Don't add a headless hook that only mirrors a component.** `useTabs` and `useMenu` were dropped because the thin native parts plus `useRovingFocus` cover custom markup.
- **No icon component and no icon set.** Components take icons as children or slots (`Button.Icon`, `Alert.Icon`). Todae draws only the glyphs a part needs to look whole, such as a close cross or a check, and `GlyphsProvider` swaps them for any library's icons. There is no global icon size scale: each slot that holds an icon has its own `icon.size` token.

## Component API

- **Compound namespaces with a `Root`.** A component with parts is a namespace object: `Menu.Root`, `Menu.Item`, `Table.HeaderCell`. A component with no parts is one export (`Stack`, `Text`, `Label`, `Checkbox`). *Why:* one consistent shape across the package.
- **Never nest namespaces** (no `Field.Button.Root`) and **one interactive role per root**. Components sit side by side: a Field and a Popover are siblings, neither wraps the other.
- **Every part forwards native attributes and its ref.** Props types extend `ComponentPropsWithRef<'element'>`, a part spreads the rest onto its element and merges `className` with Todae's own class (new code uses `cx`; older parts still join the strings by hand). *Why:* a company wrapper only has to spread props to keep everything working.
- **Parents never find children by component type.** Parts register through context, or a parent looks for a data attribute the child renders. *Why:* a company's wrapped `OptionList.Option` or `Button.Icon` must still work.
- **Routers plug in through a `render` prop** (`Link.Root`), not an `as` prop or a router dependency.
- **Text Todae writes by itself**, such as a close button's default name, comes from `StringsProvider`, never a hard-coded English string in a part.
- **Glyphs** are read from `GlyphsProvider`. Glyph state (hidden, rotated, mirrored) goes on the `[data-todae-glyph]` wrapper span, not on the `svg`, so a swapped-in icon follows it.
- **Server entries.** A component that a Server Component should render directly gets a server-safe entry: `src/server/<slug>.ts` (no `'use client'`), an entry in `vite.config.ts`, and an `exports` entry in `package.json` as `@omsoo/todae/<slug>`. Where the component reads a client provider (for example glyphs), the client version is a `*.client.tsx` wrapper exported from the root entry, and the server entry keeps Todae's own glyphs.
- **`'use client'` sits only in `src/index.ts` and the provider files**, not in component or hook files. `src/entries.test.ts` checks that each server entry's import closure has no `'use client'`, no hooks, no `createContext` and no CSS import, so helpers a server entry needs stay hook-free in their own files (`cx.ts`, `tone.ts`).

The rest of this section was read from the code rather than decided in a thread. It is what most parts do; follow it unless there is a reason not to.

- **Controlled state comes in triples** built on `useControlledValue`: `value`/`defaultValue`/`onValueChange`, and the same for `open`, `checked` and `pressed`. The callback gets the new value, not an event. `undefined` means uncontrolled.
- **`onOpenChange(open, reason)`** passes a typed reason, such as `'escape'`, `'backdrop'` or `'close-button'`, so a product can tell why an overlay closed.
- **Names.** Props types are `<Component><Part>Props` (`BadgeRootProps`). Union prop types are exported as `<Component><Prop>` (`AlertTone`, `ButtonVariant`). Form state is `disabled` and `invalid`, not `isDisabled` or `error`. Overlays take `dismissOnEscape`, `dismissOnBackdrop`, `initialFocusRef` and `restoreFocusRef`.
- **Fieldset state merges in** through `useFieldsetState`: `disabled` is OR-ed with the nearest Fieldset, and a control's own `invalid` wins over the Fieldset's.
- **Consumer handlers run first.** `composeHandlers(theirs, ours)` skips Todae's behavior when the consumer calls `preventDefault()`.
- **A part outside its Root throws** an error naming both. Misuse that still renders (an icon-only button with no name, both `checked` and `defaultChecked`) logs a development-only `console.error` or `console.warn` behind `process.env.NODE_ENV !== 'production'`.
- **State reaches CSS through `data-*` attributes.** Boolean state is an empty attribute that is absent when false (`data-selected`, `data-disabled`); enum state is its value (`data-tone`, `data-size`, `data-orientation`). Attributes that other Todae code looks up are named `data-todae-*` (`data-todae-glyph`, `data-todae-roving`).
- **`disabled` versus `aria-disabled`.** Native controls take the `disabled` attribute. Items in an ARIA widget (options, menu items) take `aria-disabled` and stay focusable, as the ARIA patterns expect.
- **Ids** come from `useDomId()` with a `todae-<thing>-` prefix, so they are safe in selectors and CSS idents.

## Hooks

- **One options object in, one result object out,** typed `Use<Name>Options` and `Use<Name>Result`.
- **Prop getters** named `get<Element>Props` (`getTriggerProps`, `getListboxProps`) return what an element needs. A getter that takes the caller's props merges them and composes the caller's ref.
- **A hook that creates ids** accepts an optional `id` and returns them as `ids`, so a recipe can wire labels by hand.

## Tokens

- **Follow DTCG 2025.10.** Aliases are JSON Pointer `$ref`s (`{ "$ref": "#/color/gray/900/$value" }`); the build rejects curly-brace aliases. *Why:* companies should be able to use standard DTCG tools on Todae's tokens.
- **Layers, lowest first:** `core` (raw scales) → `appearance` (light and dark semantics) → `density` (spacing per density) → `contract` (what components read) → button variants. A token may only reference its own layer or a lower one.
- **Components read contract tokens only.** A new component gets its own token file in `packages/design-system/tokens/components/`, named after the component, whose tokens point at semantic tokens. *Why:* a rebrand changes the appearance layer and every component follows.
- **Component token names** read `<component>`, then an optional part, the property, and an optional state (`chip.bg.hover`, `separator.color`). States come from `default`, `hover`, `active`, `focus`, `disabled`, `invalid`, `selected` and `checked`. Required state sets are declared as `slots` in `tokens/resolver.json`, and the build checks them.
- **Translucent colors take `alpha` from the `opacity` scale** with a `$ref`, not a literal. `color.bg.transparent` keeps a literal 0 on purpose.
- **Contrast is APCA (Lc), not WCAG 2 ratios.** Text pairs and their minimums live in `$extensions["dev.todae"].contrast` in `tokens/resolver.json`, and the build fails a pair that falls short. A company's tokens are checked against the same pairs.
- **The accent is neutral ink, not a hue.** Don't introduce a blue accent; the build test only allows `color.category` to read the blue scale.
- **Tones.** Status tones are `info`, `success`, `warning`, `critical`. Category tones are numbered `category-1` to `category-8`, not named after hues, so a company can re-hue without renaming. People (Avatar) take neutral and category tones only. `categoryTone(key)` hashes a string to a tone; its pinned test values must not change, since changing the hash changes every user's color.
- **Generated files are committed.** Run `pnpm tokens` after editing token files; `pnpm tokens:check` fails on drift.
- **Extensibility comes first.** Companies add sets, contexts, variants and densities in their own resolver and build them with `todae-tokens build`. New token features should work through that path, not by editing Todae's files.

## CSS

- **One cascade layer, `todae`,** with `todae.reset` (empty), `todae.base` (tokens and the modal scroll lock), `todae.components` and `todae.theme` (company tokens). `src/styles/layers.css` declares the order and is imported first by every build entry. *Why:* a company places Todae with one name, and its own CSS wins by layer order, not specificity.
- **Component styles are CSS Modules** in `@layer todae.components`. Components that style a single native element (Link, Table, Code and similar) use the `todae.components.native` sublayer, so container components such as Pagination beat them.
- **Every value comes from a contract token** through its `--todae-*` custom property. Restyling goes through tokens first; a class works for layout.
- **Classes are camelCase**, and a part's main class is `.root`. Custom properties a sheet sets for its own arithmetic are named `--_<name>` (`--_ring-room`), so they never look like a token.
- **Logical properties** (`inline`, `block`) for layout, and `:dir(rtl)` for anything that must flip. Physical sides are used only where the platform is physical, such as safe-area insets.
- **Focus rings, disabled looks and tones are checked.** `src/styles/tokenConsistency.test.ts` requires outlines to use the focus ring tokens, keeps `opacity` off disabled styles, and requires a `data-tone` rule for every tone a component takes. It also checks that a sheet reads only its own component's tokens, plus a short allowlist.
- **Forced colors.** Where a state shows only through fill (pressed, selected, checked, current), add an `@media (forced-colors: active)` rule that maps it to system colors.
- **No scrollbar styling** (`scrollbar-width`, `scrollbar-color`, `::-webkit-scrollbar`), and no `transform` on an element that may contain a tooltip trigger. Tests enforce both.
- **`!important` only for rules that must hold**, such as `VisuallyHidden.Root` and hidden tab panels.
- **Rules in `todae.base` sit in `:where()`,** so any class a company adds wins.

## Platform

- **Use the best native HTML and CSS features, with no JavaScript fallbacks and no support matrix.** The feature list is on the [Native platform](apps/docs/app/(en)/platform/page.mdx) page; add a feature there when a component starts to depend on it. *Why:* Todae stays small and gets better as browsers do.
- **Overlays.** `Dialog` and `BottomSheet` render in place on a modal `<dialog>` (no portal), so they inherit the theme. `Popover`, `Menu` and `Tooltip` use `popover="manual"` with CSS anchor positioning, and Escape goes through `useEscapeKey`. Page scroll stops through `:root:has(dialog:modal)` in CSS, not a scroll-lock hook.
- **Toast** holds text and buttons only, no nested menus or dialogs. Its region moves into the front modal through `useModalLayer`.
- **Motion** reads the motion tokens (`motion.duration.*`, `motion.easing.*`), respects `prefers-reduced-motion`, and only has to work in Chrome. Don't add workarounds for Safari motion gaps.

## Accessibility

- **Follow the ARIA Authoring Practices pattern** for each interactive component, and keep that behavior in the component or a hook, never in a recipe.
- **Toolbar keeps its no-tabindex design:** Tab is steered to the edge of a run instead of managed `tabindex`. This was chosen knowing its limits (an ancestor that cancels Tab after the hop, an item that stops Tab propagating, Safari skipping buttons by default); don't switch back.
- **Every docs example is checked with axe in a real browser** (color contrast is off there, since contrast is APCA in the token build).

## Tests

- Unit tests sit next to the code as `*.test.ts(x)` and run in jsdom.
- Behavior that needs real layout, focus or the top layer goes in `src/browser/*.browser.test.tsx`, which runs in Chromium through Playwright (`pnpm test:browser`).
- `src/components/parts.test.tsx` lists every exported part and checks it forwards native attributes and its ref. Add each new part to it.
- `src/components/overlay.parity.test.tsx` holds Dialog, Drawer and BottomSheet to one contract (labelled, initial focus, Escape, backdrop reason, focus restore, named close button). A new modal overlay should join it.
- Keep one copy of a check: when jsdom and a browser test cover the same behavior, keep the browser one only if jsdom can't model it.
- Docs tests import the built package, so run `pnpm build:ds` before `pnpm test` in a fresh checkout.

## Docs

Every component, hook and recipe has a page in `apps/docs/app/(en)` and a Korean twin in `apps/docs/app/ko`, changed in the same pull request (see [`CLAUDE.md`](CLAUDE.md) and [`apps/docs/TRANSLATING.md`](apps/docs/TRANSLATING.md)).

- **Page shape:** a short intro with a live `<Example>` and code, any topic sections, then `## Accessible composition` (**Todae handles:** / **You supply:** / **Watch for:**), `## When to use` (**When:** / **When not:**), and `## Props`. The docs MCP server reads "When to use", so don't leave it out.
- **Prop descriptions** live in each part's `*.meta.ts` and reach the props table through `pnpm schema`. When one changes, update its Korean entry in `apps/docs/lib/i18n/props/ko.json`.
- **Tables are JSX** with `Table` parts. The docs MDX has no GFM, so pipe tables render as plain text.
- **Write narrow claims.** Absolute words such as "only", "never" and "always" are the claims reviews most often find wrong. State what the code does and stop.

## Recording a decision

When the project settles a question about concepts, API shape, tokens, CSS or platform use, add it to the section it belongs to here: the rule, then why. Remove rules that a later decision replaces instead of keeping both.
