---
'@tounsoo/todae': minor
---

The shipped prop schema now matches the TypeScript types, and RadioGroup.Root takes `defaultValue={null}`.

- Progress.Root, Meter.Root and Slider.Root take a number or string `value`, not a string list.
- themeOverrideStyle takes an object of override values, null or undefined, instead of `unknown`. Cast input you haven't checked.
- In `schema/components.json` and the docs MCP, useHotkey's `enabled` is now `options.enabled` and useAnnouncer's `politeness` is now `options.politeness`.
