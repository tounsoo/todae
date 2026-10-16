# Todae

Todae is a low-level React design system that companies build their own design systems on. A company adds a token package, a few TypeScript declarations and thin wrappers around Todae's parts, without forking Todae.

Docs, live examples and a theme playground: [todae.omsoo.design](https://todae.omsoo.design)

## Install

```sh
npm install @tounsoo/todae
```

Todae needs React 19.

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

`todae.css` puts its rules in the `todae` cascade layer. To use it with Tailwind CSS or another reset, see [CSS layers](https://todae.omsoo.design/guides/css-layers).

## What's in the package

- `@tounsoo/todae`: components, headless hooks and providers.
- `@tounsoo/todae/<name>`, such as `@tounsoo/todae/stack`: entries that a React Server Component can render.
- `@tounsoo/todae/todae.css`: the stylesheet, with every token as a CSS custom property.
- `@tounsoo/todae/tokens.json`: the token catalog.
- `@tounsoo/todae/schema/components.json`: each component's parts and props.
- The `todae-tokens` CLI and `@tounsoo/todae/tokens-builder`: build a company's tokens on top of Todae's. See [Build on Todae](https://todae.omsoo.design/guides/build-on-todae).

## Browser support

Todae uses current browser features, such as CSS anchor positioning, the Popover API and `<dialog>`, and ships no polyfills for them. Calendar, the date and time pickers and the date and time helpers read the global `Temporal` object; to support a browser without it, install a Temporal polyfill globally. [Native platform](https://todae.omsoo.design/platform) lists the features Todae needs and what happens without the others.

## License

[MIT](https://github.com/tounsoo/todae/blob/main/LICENSE)
