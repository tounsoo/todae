---
'@tounsoo/todae': minor
---

The shipped prop schema now matches the TypeScript types, and RadioGroup.Root takes `defaultValue={null}`.

- Progress.Root, Meter.Root and Slider.Root take a number or string `value`, not a string list, and so does Slider.Root's `defaultValue`.
- themeOverrideStyle takes an object of override values, null or undefined, instead of `unknown`. Cast input you haven't checked.
- `schema/components.json` and the docs MCP named two hook options wrongly. They now list useHotkey's `options.enabled` and useAnnouncer's `options.politeness`; the hooks themselves haven't changed.
