## Why

Anvil's segmented control is a gray track with a white selected segment and a 2px blue focus ring. ToggleGroup shipped a token for almost every button state. The set now covers the track, the pressed segment, and only the segment properties Anvil does not share with Button.

## What

Track tokens are `togglegroup.bg`, `border`, `border-width`, `radius`, `padding`, and `gap`. The border default refs `color.border.subtle`. Pressed tokens are `togglegroup.item.bg.pressed`, `fg.pressed`, `border.pressed`, and `shadow.pressed`. Other segment colors, horizontal padding, and the join radius inherit `button.*`.

A horizontal group whose gap is not `0px` is a 40px track. Its segments share one width, so the label does not set the width. Vertical padding is `0`. The segment fills the track's content box. Ghost rows, such as Message actions, do not draw the track. A vertical group does not draw the track. It stacks with `toolbar.gap`.

The Anvil preset loads Nunito Sans. Headings name Sofia Pro and fall back to Nunito Sans. Buttons, fields, and tabs are 16px. Chips are 14px. The focus ring is 2px `#0265dc`.

`option.check.fg` now refs `option.fg.selected`. Overriding `option.fg.selected` recolors the check in existing themes.

The changesets are `minor`. Gilfoyle wants that bump because the new tokens are a feature. Before 1.0 this repo also uses `minor` for a breaking change, and the check recolor is called out for that reason.

## Verification

The head is the commit that adds this file.

- `pnpm typecheck` exited 0 on `8a68c395`. This commit is the segment size fix on top of that head.
- `pnpm lint` exited 0 on `8a68c395`.
- `pnpm test` exited 0 on `8a68c395`. The design system ran 2782 tests. Docs ran 354 tests. After this fix, `ToggleGroup.test.tsx` and `tokenConsistency.test.ts` passed again, 23 tests.
- `pnpm tokens:check` exited 0 on `8a68c395`.
- `pnpm schema` exited 0 and left no diff.

Anvil preset, Range group, computed in Chrome.

- Track background `oklch(0.949 0 0)`, border `1px oklch(0.925 0 0)`, radius `6px`, padding `4px`, gap `8px`, height `40px`, `box-sizing: border-box`.
- Day, Week, and Month are each `79.0938px` wide and `30px` tall. Padding is `0px 16px`. The selected segment background is `oklch(1 0 0)`, radius `3px`, border width `0`, shadow `oklch(0.218 0 0 / 0.08) 0px 2px 8px 0px`.
- Focus outline `oklch(0.532 0.198 258) solid 2px`, offset `2px`. That color is `#0265dc`.

The rendered `@servicetitan/anvil2@3.17.0` CSS is also a `40px` border box with `4px` padding and a `1px` border, so its segment is `30px`, not `32px`. The `32px` figure leaves out that border. Anvil's own labels are not equal. This group makes them equal. Vertical padding is `0` on both.

| Token | Default | Why it ships |
| --- | --- | --- |
| `togglegroup.bg` | `color.bg.transparent` | Track fill. A button has no track. |
| `togglegroup.border` | `color.border.subtle` | Track edge. This refs a border token. |
| `togglegroup.border-width` | `0px` | An empty track has no edge. Anvil sets 1px. |
| `togglegroup.radius` | `button.base.radius` | Track corner. Anvil sets 6px. |
| `togglegroup.padding` | `0px` | Track inset. Anvil sets 4px. |
| `togglegroup.gap` | `0px` | Joined at 0. Anvil sets 8px. |
| `togglegroup.item.bg.pressed` | `button.secondary.bg.active` | Selected fill. Anvil is white. Button active is a wash. |
| `togglegroup.item.fg.pressed` | `button.secondary.fg.active` | Selected text. |
| `togglegroup.item.border.pressed` | `button.secondary.border.active` | Selected edge. Anvil clears it. |
| `togglegroup.item.shadow.pressed` | `shadow.none` | Selected shadow. Anvil is `0 2px 8px rgba(26,26,26,.08)`. |
| `togglegroup.item.radius` | `button.base.radius` | Anvil's segment is 3px. Anvil's button is 6px. |
| `togglegroup.item.padding.y` | `button.base.padding.y` | Anvil sets this to 0 so the segment fills the track. |
| `togglegroup.item.bg.default` | `button.secondary.bg.default` | The segment rests transparent. Anvil's button rests on a 6% ink wash. |
| `togglegroup.item.bg.hover` | `button.secondary.bg.hover` | Hover is `#8b8b8b` at 8%. Button hover is ink at about 8%. |
| `togglegroup.item.bg.active` | `button.secondary.bg.active` | Press is `#8b8b8b` at 16%. Button press is ink at 16%. |
| `togglegroup.item.pressed-ring-width` | `button.base.pressed-ring-width` | Anvil's selected segment has no inset ring. Button draws 1px. |

Docker is not installed, so `pnpm --filter docs test:visual:docker` cannot run. `apps/docs/scripts/visual.sh` exits before Playwright because `docker` is not on the machine.
