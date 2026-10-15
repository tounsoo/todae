# Todae

Todae is a low-level React design system that companies build their own design systems on. A company adds a token package, a few TypeScript declarations and thin wrappers around Todae's parts, without forking Todae.

Docs, live examples and a theme playground: [todae.omsoo.design](https://todae.omsoo.design)

## Install

```sh
npm install @omsoo.design/todae
```

Todae needs React 19.

## Use

Import the stylesheet once, then use the components.

```css
@import '@omsoo.design/todae/todae.css';
```

```tsx
import { Button, ThemeProvider } from '@omsoo.design/todae';

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

- `@omsoo.design/todae`: components, headless hooks and providers.
- `@omsoo.design/todae/<name>`, such as `@omsoo.design/todae/stack`: entries that a React Server Component can render.
- `@omsoo.design/todae/todae.css`: the stylesheet, with every token as a CSS custom property.
- `@omsoo.design/todae/tokens.json`: the token catalog.
- `@omsoo.design/todae/schema/components.json`: each component's parts and props.
- The `todae-tokens` CLI and `@omsoo.design/todae/tokens-builder`: build a company's tokens on top of Todae's. See [Build on Todae](https://todae.omsoo.design/guides/build-on-todae).

## License

[MIT](https://github.com/tounsoo/todae/blob/main/LICENSE)
