# Todae

Todae is a low-level React design system that companies build their own design systems on. It ships accessible components, headless hooks, design tokens in the [DTCG](https://www.designtokens.org/) format and a token build. A company adds its own token package, a few TypeScript declarations and thin wrappers around Todae's parts, without forking Todae.

Docs, live examples and a theme playground: [todae.omsoo.design](https://todae.omsoo.design)

Todae is published on npm as [`@tounsoo/todae`](https://www.npmjs.com/package/@tounsoo/todae). It is on 0.x, so a minor release can break the API, as [Versioning](#versioning) says, and 1.0.0 is not planned. The [changelog](packages/design-system/CHANGELOG.md) lists what each release changed and, for each breaking change, what to change in your code.

## Versioning

The public API is the exported props and types, the design tokens, the emitted `--todae-*` CSS variables, the documented HTML attributes, and the documented `todae-tokens` CLI.

From 1.0.0, semver follows that API. Removing, renaming, or narrowing part of the public API is a major change. Changing what a token or a `--todae-*` variable means is a major change. Adding to the public API is a minor change. A token value change, or a change to product copy, is a patch, and the changelog names the change.

From 1.0.0, a deprecation ships in a minor release. It includes a warning in the runtime or in the docs, and it names the replacement. Only a later major release removes a deprecated API. Todae announces that deprecation at least about 30 days before that major release, and at least one minor release before it.

Until 1.0.0 ships, changeset bumps stay on 0.x, with a breaking change as a minor bump and every other change as a patch.

## Install

```sh
npm install @tounsoo/todae
```

Todae needs React 19, and its types need TypeScript 6 or later. An app made with create-next-app 16 starts on TypeScript 5, and npm then stops with a peer dependency error. Install TypeScript 6.0 with Todae, since typescript-eslint, which Next.js's ESLint config uses, accepts TypeScript below 6.1:

```sh
npm install @tounsoo/todae typescript@~6.0
```

## Quick start

Import the stylesheet once:

```css
@import '@tounsoo/todae/todae.css';
```

Then wrap the app in the providers and use the components:

```tsx
import { Button, DensityProvider, ThemeProvider } from '@tounsoo/todae';

export function App() {
  return (
    <ThemeProvider appearance="system">
      <DensityProvider density="comfortable">
        <Button.Root>Save</Button.Root>
      </DensityProvider>
    </ThemeProvider>
  );
}
```

`appearance="system"` follows the user's light or dark setting. Both providers are optional: without them, the page is light and comfortable.

`todae.css` puts its rules in the `todae` cascade layer, so CSS outside a layer, such as a reset of your own, beats it. To use it with Tailwind CSS or a reset, see [CSS layers](https://todae.omsoo.design/guides/css-layers).

In Next.js, the main entry is a client module: a Server Component can render the providers, but parts such as `Button.Root` go in a file that starts with `'use client'`. [Get started](https://todae.omsoo.design/guides/get-started) covers this and the CSS order Next.js needs.

## Build your design system on Todae

- [Build on Todae](https://todae.omsoo.design/guides/build-on-todae) shows how to layer your tokens on Todae's, override them and wrap Todae's components.
- [Tokens](https://todae.omsoo.design/tokens) lists every token Todae ships.
- [Playground](https://todae.omsoo.design/playground) lets you try a theme and copy it as JSON.
- [MCP server](https://todae.omsoo.design/mcp) gives AI agents Todae's components, tokens and token build. Connect it at `https://todae.omsoo.design/api/mcp`.

The docs are in English and [Korean](https://todae.omsoo.design/ko).

## Browser support

Chrome is Todae's target, along with the other browsers on Chromium, such as Edge. Safari and Firefox are supported too, on one condition: nothing may break there. Every component works in them, apart from the known Firefox issues below, but some polish is Chrome-only, and [What Safari and Firefox do differently](#what-safari-and-firefox-do-differently) lists it.

Todae uses current HTML, CSS and JavaScript features and ships no polyfills for them, so its support follows those features rather than a list it maintains. [Native platform](https://todae.omsoo.design/platform) says what happens without each feature it lists.

Calendar, `Field.DateInput`, `Field.DateRangeInput`, `Field.TimeInput`, `Field.DateTimeInput`, `timeOptions`, `parseDate`, `parseDateRange`, `formatDateRange`, `parseTime`, `parseDateTime` and `formatRelativeTime` read the global [Temporal](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal) object. Todae ships no Temporal polyfill. To support a browser without Temporal, install a polyfill globally in your app, such as `temporal-polyfill/global`.

Checked against public browser support data on 2026-10-16, these are the first versions that have the CSS anchor positioning Todae uses and every feature the Native platform page marks as needed:

| Browser | All but the Temporal parts | Everything, Temporal included |
| --- | --- | --- |
| Chrome and Edge | 128 | 144 |
| Firefox | 147 | 147 |
| Safari and iOS Safari | 26 | Not shipped; load a polyfill |

CSS anchor positioning sets the floor in every browser. In Chrome and Edge it is `position-try-fallbacks`, which Todae uses for its fallbacks and which arrived in 128. On iOS and iPadOS, every browser uses Safari's engine, so Chrome and Edge there follow the Safari row, and the Safari lines below. The versions are not pinned in code. Todae's component browser tests run in Chromium, Firefox and WebKit through Playwright, which ship builds newer than these floors, so the floors themselves are not tested.

A browser test that fails in Chromium or WebKit fails CI. Firefox has known issues, tracked in [issue 367](https://github.com/tounsoo/todae/issues/367). The Firefox tests those issues break still run in CI, but their failures show as warnings instead of failing it, and any other Firefox failure fails it as before. Firefox goes back to failing CI on every failure before 1.0 ships.

### What Safari and Firefox do differently

Each line says what Chrome does and what Safari and Firefox do instead. Motion only has to work in Chrome, as [ARCHITECTURE.md](ARCHITECTURE.md#platform) records, and under reduced motion every browser skips the slides and height changes below. Some of these need a newer Chrome than the floor above, up to Chrome 140, and an older Chrome does what Safari and Firefox do.

- **Disclosure and Nav branches**: grow and shrink to their height as they open and close. Both change the height at once: Safari fades the content in and out, and Firefox fades it in and hides it at once as it closes.
- **Toast**: in a list, gives back its height as it leaves, so the toasts behind it slide into place. Safari and Firefox move them once it is gone.
- **Conversation's newest message**: grows into place. Safari and Firefox fade it in at full size.
- **`Conversation.ScrollButton`**: fades out. Firefox hides it at once.
- **Tabs**: the indicator slides to the new tab. Safari and Firefox move it at once.
- **Coachmark**: the hole and popup slide to a tour's next target. Safari and Firefox move them at once.
- **Progress and Meter**: the fill glides to a new value. Firefox jumps.
- **`Field.Textarea` with `autoGrow`**: grows with its text. Firefox before 152 and Safari before 26.2 keep its rows and scroll inside it.
- **`Field.Select`**: draws its button and list from Todae's tokens, as Safari 27 does too. Firefox and Safari 26 show the browser's own list, with the same value and keys, and keep the browser's arrow instead of the `chevron` glyph.
- **`Field.Select` in a field**: a press beside the select, such as on an `Icon`, opens its list. Safari only focuses the select.
- **Contents**: marks the current link from CSS as well, before its script runs. Safari and Firefox mark it once the script runs.
- **EmptyState's description**: avoids a lone last word, as Safari does too. Firefox breaks its lines raggedly.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) to set up the repository, run the docs and tests, and open a pull request.

## License

[MIT](LICENSE)
