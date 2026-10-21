# Todae

Todae is a low-level React design system that companies build their own design systems on. A company adds a token package, a few TypeScript declarations and thin wrappers around Todae's parts, without forking Todae.

Docs, live examples and a theme playground: [todae.omsoo.design](https://todae.omsoo.design)

## Install

```sh
npm install @tounsoo/todae
```

Todae needs React 19, and its types need TypeScript 6 or later. An app made with create-next-app 16 starts on TypeScript 5, and npm then stops with a peer dependency error. Install TypeScript 6.0 with Todae, since Next.js's ESLint config accepts TypeScript below 6.1 only:

```sh
npm install @tounsoo/todae typescript@~6.0
```

## Use

Import the stylesheet once, then use the components.

```css
@import '@tounsoo/todae/todae.css';
```

```tsx
import { Button, ThemeProvider } from '@tounsoo/todae';

export function App() {
  return (
    <ThemeProvider appearance="system">
      <Button.Root>Save</Button.Root>
    </ThemeProvider>
  );
}
```

`todae.css` puts its rules in the `todae` cascade layer, so CSS outside a layer, such as a reset of your own, beats it. To use it with Tailwind CSS or a reset, see [CSS layers](https://todae.omsoo.design/guides/css-layers).

In Next.js, the main entry is a client module: a Server Component can render the providers, but parts such as `Button.Root` go in a file that starts with `'use client'`. [Get started](https://todae.omsoo.design/guides/get-started) covers this and the CSS order Next.js needs.

## What's in the package

- `@tounsoo/todae`: components, headless hooks and providers.
- `@tounsoo/todae/<name>`, such as `@tounsoo/todae/stack`: entries that a React Server Component can render.
- `@tounsoo/todae/todae.css`: the stylesheet, with every token as a CSS custom property.
- `@tounsoo/todae/tokens.json`: the token catalog.
- `@tounsoo/todae/schema/components.json`: each component's parts and props.
- The `todae-tokens` CLI and `@tounsoo/todae/tokens-builder`: build a company's tokens on top of Todae's. See [Build on Todae](https://todae.omsoo.design/guides/build-on-todae).

## Browser support

Todae uses current browser features, such as CSS anchor positioning, the Popover API and `<dialog>`, and ships no polyfills for them. Calendar, the date and time pickers, `parseDate`, `parseTime` and `parseDateTime` read the global `Temporal` object; to support a browser without it, install a Temporal polyfill globally. [Native platform](https://todae.omsoo.design/platform) says what happens without each feature it lists.

## License

[MIT](https://github.com/tounsoo/todae/blob/main/LICENSE)
