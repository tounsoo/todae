# Todae

Todae is a low-level React design system that companies build their own design systems on. It ships accessible components, headless hooks, design tokens in the [DTCG](https://www.designtokens.org/) format and a token build. A company adds its own token package, a few TypeScript declarations and thin wrappers around Todae's parts, without forking Todae.

Docs, live examples and a theme playground: [todae.omsoo.design](https://todae.omsoo.design)

Todae is published on npm as [`@tounsoo/todae`](https://www.npmjs.com/package/@tounsoo/todae), starting with 0.1.0. Before 1.0, a minor version can change the API.

## Install

```sh
npm install @tounsoo/todae
```

Todae needs React 19.

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

`todae.css` puts its rules in the `todae` cascade layer. To use it with Tailwind CSS or another reset, see [CSS layers](https://todae.omsoo.design/guides/css-layers).

## Build your design system on Todae

- [Build on Todae](https://todae.omsoo.design/guides/build-on-todae) shows how to layer your tokens on Todae's, override them and wrap Todae's components.
- [Tokens](https://todae.omsoo.design/tokens) lists every token Todae ships.
- [Playground](https://todae.omsoo.design/playground) lets you try a theme and copy it as JSON.
- [MCP server](https://todae.omsoo.design/mcp) gives AI agents Todae's components, tokens and token build. Connect it at `https://todae.omsoo.design/api/mcp`.

The docs are in English and [Korean](https://todae.omsoo.design/ko).

## Browser support

Todae uses current HTML, CSS and JavaScript features and ships no polyfills for them, so it has no list of browser versions. [Native platform](https://todae.omsoo.design/platform) lists the features it uses, marks the ones Todae needs, and says what happens without the others.

Calendar, `Field.DatePicker`, `Field.TimePicker`, `Field.DateTimePicker`, `parseDate`, `parseTime` and `parseDateTime` read the global [Temporal](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal) object. Todae ships no Temporal polyfill. To support a browser without Temporal, install a polyfill globally in your app, such as `temporal-polyfill/global`.

Todae's browser tests run in Chromium.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) to set up the repository, run the docs and tests, and open a pull request.

## License

[MIT](LICENSE)
