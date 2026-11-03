# @tounsoo/todae

## 0.6.0

### Minor Changes

- Add `chip.min-height`, `chip.font.weight` and `chip.dismiss.*` tokens, apply `option.leading` and `option.font.weight` to Field.Select options, and recolor the option check from `option.fg.selected`, so overriding `option.fg.selected` recolors the check in existing themes. ([#276](https://github.com/tounsoo/todae/pull/276))

- Checkbox.Root, Switch.Root and RadioGroup.Root now follow a form reset, so `data-checked` and the stored value match what the form put back, `onCheckedChange` or `onValueChange` reports the value the reset put back, and the first change after it is reported again. ([#330](https://github.com/tounsoo/todae/pull/330))
  
  - RadioGroup.Root's `onValueChange` now takes `string | null`, and gets `null` when a form reset leaves no radio selected. Replace a callback typed `(value: string) => void`, such as a `useState<string>` setter, with one that takes `string | null`, or map `null` to your own empty value.

- BREAKING: Remove Composer, including its send and stop strings and glyphs. ([#293](https://github.com/tounsoo/todae/pull/293))
  
  - Build the chat composer from the recipe at /recipes/chat-composer-mentions, with Field, Button, Attachment, and useMentions. Pass that same mention source to MentionText.
  - Delete `send` and `stop` from Strings and Glyphs.

- Todae's controlled-state hooks and components now share one model, the public `useControlledState`, which takes the change callback and replaces `useControlledValue`. ([#317](https://github.com/tounsoo/todae/pull/317))
  
  - Replace `useControlledValue(value, defaultValue, onChange)` with `useControlledState(value, defaultValue, onChange)`. Its setter builds on the latest write, so a value set twice in one event calls `onChange` once.
  - Where you called `useControlledState(value, defaultValue)` and then your callback yourself, pass the callback as the third argument and drop your own call. The setter now calls it, and a controlled value with no callback stays read-only.
  - `useControlledState` returns a third item, `latest()`. Code that spreads or checks the tuple's length sees three items.
  - A toggle Button and Menu.CheckboxItem pressed twice before a render now toggle twice, and the second press no longer reports the first value again.
  - useCombobox reports each change only after every change of a pick or edit is stored, and drops a report that the owner's own later request from a change callback has replaced. So an owner that keeps the list open or sets its own text from onValueChange gets what it asked for.
  - A controlled value with no change callback is read-only, so a press, Escape or an outside press doesn't render Menu.RadioGroup, Menu.Root, ToggleGroup, a Field picker or a useCombobox popover again. A Menu.Trigger click also drops a context request the owner turned down.
  - Checkbox.Root, Switch.Root and RadioGroup.Root report taking both the controlled and the default prop once, not on every render.
  - Slider.Root from `@tounsoo/todae` reads the nearest Fieldset: a disabled Fieldset disables it, and an invalid one sets `aria-invalid`, which the slider's own `aria-invalid` overrides. It also asks its validation scope to recheck as it renders, like the other controls. The server entry, `@tounsoo/todae/slider`, is unchanged.

- BREAKING: useCombobox and useMentions now share one option-list engine, so their async loading, active row and arrow keys behave the same way. ([#323](https://github.com/tounsoo/todae/pull/323))
  
  - useCombobox shows the options `loadOptions` returns as they are, and `filter` now applies only to sync `options`. If you relied on the label filter to narrow loaded options, match them in your loader.
  - useCombobox loads the full list, `loadOptions('')`, while the input shows the selected label in single mode, as it already shows sync options. It no longer loads the label's text.
  - With no active row, ArrowUp moves to the last row in both hooks. useCombobox used to move to the first.
  - useMentions keeps the trigger's last suggestions on show while the next query loads, and Enter picks nothing until the new list is in, as useCombobox already did. Text changing before the word no longer reloads its suggestions.
  - While the next query loads, no row is active in either hook unless the user highlights one during that load. useCombobox used to keep a row highlighted on the last list.
  - A row the user highlights stays active in useCombobox while the list changes around it, instead of jumping back to the selected value. In both hooks, a highlight whose row leaves the list is forgotten and does not come back with the row.

- usePopover takes an `anchorName` option that places the popover at a CSS anchor other than its trigger, such as useMentions' `caretPeekAnchorName`, and a modal now recognizes a moved-in layer by `data-todae-guest-layer`. ([#319](https://github.com/tounsoo/todae/pull/319))
  
  - Toast.Region's host now carries `data-todae-guest-layer` instead of `data-todae-toast-host`; update any selector that targets the old attribute.
  - To show a peek at the caret's mention, pass `anchorName: useMentions().caretPeekAnchorName` to `usePopover`. Both are new, so there is nothing to migrate.

- Todae's contract set now checks indicator and pill contrast: progress and meter fills on `progress.track` and the switch thumb and check on `selection.bg.checked` need Lc 30, and primary button text on each of its four fills and `mention.fg.default` on `mention.bg.hover` need Lc 60. ([#292](https://github.com/tounsoo/todae/pull/292))
  
  - A company token build inherits these pairs, so a resolver that built on 0.5.2 can now stop with "contrast: N pair(s) fail APCA", for example a primary button on `color.red.500` with Todae's dark text. Set the token to the lightness the error names, or lower that pair's `min` with an entry of the same `fg` and `bg` in your resolver's `$extensions["dev.todae"].contrast`. In development, `ThemeProvider` overrides now also warn on these pairs.

- Move Button's token shape into `tokens/resolver.json` as `slots` and cut `@tounsoo/todae/tokens-builder` down to what a company build needs. ([#324](https://github.com/tounsoo/todae/pull/324))
  
  - `@tounsoo/todae/tokens-builder` now exports only `buildCompanyTokens`, `cli`, `contrastResults`, `apcaContrast`, `oklchToSrgb`, `resolveEntries`, `parseScope` and the resolver types (`ContrastPair`, `ContrastResult`, `CompanyTokensResult`, `EntryToken`, `FlatToken`, `Layer`, `ResolvedEntry`, `Rule`, `SlotRules`, `TodaeExtension`, `TokenEntry`, `TokenRef`). Import nothing else from it; the build internals, such as `validatePaintPacks`, `emitCss`, `loadResolver` and `buildTokensGraph`, are gone.
  - The `button` value of `$extensions["dev.todae"].rules` is gone, and a resolver that lists it fails. Delete `"rules": ["button"]` from your `buttonVariant` and `button` entries; they keep Todae's button `slots`, so the build still checks a variant's shape.
  - A `slots` group now lists every child its group may have, subgroups included, so a token in a subgroup the slot doesn't list fails the build. Add the subgroup's name to the slot's list, or declare its own slot group for it.
  - A company resolver can no longer change one of Todae's `slots` groups or declare a `button.<variant>.*` token outside its `buttonVariant` context. Add slot groups of your own instead, and move such tokens into the variant's context.
  - A company build now rejects a `button.*` token that is neither in a `buttonVariant` context nor under `button.base`, a `button.base` token outside the `button` set, and a second alias modifier on the `button` root. Move such tokens into a variant's context or the `button` set.

- Field.Root keeps one registry of its controls, so `useField`, the pickers, Field.Counter and the step buttons share how a field decides which control owns its id, name and focus. ([#322](https://github.com/tounsoo/todae/pull/322))
  
  - `data-todae-field-control` is now always empty on a control from `useField().getControlProps()`; it no longer reads `"name"` for the control that took the field's name. Don't select on its value, and `FieldControlWire['data-todae-field-control']` is typed `''`.
  - Field pickers' buttons no longer carry `data-todae-field-picker`. Find a picker by its role and name instead.
  - Field.Counter outside Field.Root now throws "Field parts must be rendered inside Field.Root", like the other Field parts.
  - Field.Counter counts the Field.TextInput or Field.Textarea that mounted last, and the one before it once that one unmounts. With none left it shows nothing, instead of the last count.
  - A press on a Field.Root's shell focuses the control that mounted last, else the picker that mounted last. Before, once that control unmounted, the press went to the first control in the shell.

- Toast takes Escape through Todae's Escape stack instead of stopping the key, so a layer inside a toast, such as a button's tooltip, closes first, and Toast.Region's code is split into focused hooks with no other change in behavior. ([#321](https://github.com/tounsoo/todae/pull/321))
  
  - Escape in a toast or on the region no longer stops propagation: it reaches your own `keydown` listeners with `defaultPrevented` set, so a listener of yours that should leave a key Todae took alone checks `event.defaultPrevented`.
  - A toast and the region join the Escape stack when focus comes into the region, so an overlay shown after that, such as a popover, now closes on Escape before the toasts showing then; press Escape again to dismiss the toast.
  - A `keydown` handler of yours above `Toast.Region` that stops Escape's propagation now keeps the key from the toasts, as it already does from Todae's popovers and menus.
  - A control inside a toast that prevents Escape's default, such as a field of yours that uses the key, now keeps the toast open, as a key a control already took passes the Escape stack by.

- Todae's token resolver now declares each component's own state words, such as `option.bg.selected` and `tabs.fg.selected`, as `slots` on that component's stateful properties, so the token build holds those groups to exactly the words listed. ([#325](https://github.com/tounsoo/todae/pull/325))
  
  - A company resolver can no longer add a new child under one of these groups (for example `option.bg.pressed` or `focus.ring.style`), whether in its own set or in an extension of Todae's `contract` or `focus` set. Put a new state in a token group of your own, such as `brand.*`, or set the existing tokens' values instead.

### Patch Changes

- Keep a one-time code's caret when its label is clicked. ([#313](https://github.com/tounsoo/todae/pull/313))

- Add Mention.Root, MentionText and defineMentionSource, with their prop and source types: one `defineMentionSource` object feeds both `useMentions` while composing and `MentionText` in a sent message, which draws each mention as a Mention.Root button or link with a peek card from the source's `renderPeek`, styled by the new `mention.*` tokens. ([#327](https://github.com/tounsoo/todae/pull/327))

- BottomSheet now runs on the same modal shell as Dialog and Drawer, every close part (Dialog, Drawer and BottomSheet Close, Toast.Close, Alert.Close and Attachment.Remove) renders one shared close button, and a Dialog, Drawer or BottomSheet Title, Description or Close outside its Root throws one message that names all three. ([#320](https://github.com/tounsoo/todae/pull/320))

- ThemeProvider's development contrast check and the tokens-builder APCA helpers now share one copy of the OKLCH and APCA math, with the same results as before. ([#316](https://github.com/tounsoo/todae/pull/316))

- Publish `tokens/api.json`, a list of every public token path and its type, and an empty `tokens/api-approved-removals.json`. ([#279](https://github.com/tounsoo/todae/pull/279))

- useTooltip opens a hover tip immediately while another hover tip is open, and for that tip's `skipDelay` milliseconds after the last hover tip closes. A `skipDelay` of 0 or less turns skipping off, so that tip always waits its show delay. ([#299](https://github.com/tounsoo/todae/pull/299))

- Add `togglegroup.*` tokens for the track and for the segment properties that differ from Button, so a theme can restyle ToggleGroup as a segmented control. ([#276](https://github.com/tounsoo/todae/pull/276))

## 0.5.2

### Patch Changes

- useReorder drags with a finger or a pen through pointer events, Escape cancels that drag, and a handle also arms on mousedown, which WebKit sends without pointerdown after a drag. ([#272](https://github.com/tounsoo/todae/pull/272))

## 0.5.1

### Patch Changes

- Contents paints the current link with native CSS scrollspy in Chromium. ([#269](https://github.com/tounsoo/todae/pull/269))

## 0.5.0

### Minor Changes

- Avatar drops `size` and `Avatar.Group`; stacked avatars are the Avatar group recipe. ([#258](https://github.com/tounsoo/todae/pull/258))
  
  - `Avatar.Group` is removed, along with `AvatarGroupProps` and the `avatar.group.overlap`, `avatar.group.ring.width` and `avatar.group.ring.color` tokens. The ring color is now `--avatar-group-ring` in the recipe's CSS, set on the stack and falling back to the surface color. Build the stack from `Avatar.Root` and the Avatar group recipe.
  - Remove `size` and `AvatarSize` from `Avatar.Root`, and remove the `avatar.size.sm`, `avatar.size.md` and `avatar.size.lg` scale. The avatar draws at `avatar.size` (2rem). Set `--todae-avatar-size`, or `inline-size` and `block-size`, on the avatar or an ancestor. A ThemeProvider or a DensityProvider between that ancestor and the avatar declares the token again, as does a scoped theme root. Or override `avatar.size` in the theme.
  - `data-size` is no longer rendered.

- Add Splitter.Root, Splitter.Panel and Splitter.Handle for resizable panes. ([#227](https://github.com/tounsoo/todae/pull/227))
  
  - `Strings` has a new `resizePanel` key; add it to a `StringsProvider` `strings` object you type as a full `Strings`.

- Text and Prose drop their component type-scale size tokens and use `font.size.*`. ([#261](https://github.com/tounsoo/todae/pull/261))
  
  - Remove `text.size.2` through `text.size.6` and `--todae-text-size-*`. Set the size from `font.size.*` (`--todae-font-size-*`). Body stays step 3. Headings stay h1 on 6, h2 on 5, h3 on 4, h4 and h5 on 3, and h6 on 2.
  - Remove `prose.size` and `prose.h1.size` through `prose.h6.size`, plus `--todae-prose-size` and `--todae-prose-h1-size` through `--todae-prose-h6-size`. Prose uses the same steps.

- Text.Root drops `size` and takes `variant="label"` for the label role. ([#257](https://github.com/tounsoo/todae/pull/257))
  
  - Remove `size`. Body text stays the medium scale, and a heading's `as` still picks its scale.
  - Use `variant="label"` where you passed `size="label"`.
  - Set `font-size` from a `font.size.*` variable (`--todae-font-size-*`) in your own CSS for any other scale. Changing the token resizes every use of that step.

### Patch Changes

- Add `formatRelativeTime`, which writes a time relative to a `now` you pass, such as "3 minutes ago". ([#222](https://github.com/tounsoo/todae/pull/222))

- Add `lines` to `Text.Root`, which clamps text to that many lines and shows the whole text in a tooltip when it is cut. ([#226](https://github.com/tounsoo/todae/pull/226))

- Add useInlineEdit for editing a value in place. ([#225](https://github.com/tounsoo/todae/pull/225))

- Docs name `CATEGORY_TONES`, `CategoryTone`, and `THEME_OVERRIDE_KEYS`. ([#265](https://github.com/tounsoo/todae/pull/265))

- A Contents pick lapses when its heading remounts with the same id. ([#256](https://github.com/tounsoo/todae/pull/256))

- CI checks the shipped JavaScript and CSS size. ([#260](https://github.com/tounsoo/todae/pull/260))

- Add `useReorder`, a hook that lets a list be reordered by dragging a handle. ([#221](https://github.com/tounsoo/todae/pull/221))

- Fix focus on close when `restoreFocusRef` changes while an overlay that takes it is open, such as `Dialog.Root`, `Drawer.Root`, `BottomSheet.Root` or `usePopover`. ([#231](https://github.com/tounsoo/todae/pull/231))

- Add Field.OneTimeCode, one input drawn as boxes for sign-in and verification codes. ([#229](https://github.com/tounsoo/todae/pull/229))

- Prose body and headings draw at `prose.font.size` and `prose.h1.font.size` through `prose.h6.font.size`. ([#268](https://github.com/tounsoo/todae/pull/268))

- CI checks the published tarball. ([#259](https://github.com/tounsoo/todae/pull/259))

- A Contents pick lapses when its section leaves the page. ([#233](https://github.com/tounsoo/todae/pull/233))

- Add `show` to `Splitter.Root`, which can show one panel across the root and keep the other panel mounted. ([#231](https://github.com/tounsoo/todae/pull/231))

- An icon-only Button.Root in a Field.Root (not a Field.Textarea) is one field line tall on its first line (new field.action.size token) and a press on it leaves focus where it is in the field; an Icon, Affix or icon-only button beside a Field.Select is centered on it; and Field.TextInput keeps its caret when its type changes. ([#233](https://github.com/tounsoo/todae/pull/233))

- Add Steps.Root variant="progress" for where a person is in a form of several steps. ([#223](https://github.com/tounsoo/todae/pull/223))

- Add `Menu.ContextTrigger`, which opens a menu at the pointer on a right click or an Android long press, or below the focused element on Shift+F10 or the ContextMenu key. ([#224](https://github.com/tounsoo/todae/pull/224))

- Text body draws at `text.font.size`. ([#264](https://github.com/tounsoo/todae/pull/264))

- Text headings draw at `text.h1.font.size` through `text.h6.font.size`. ([#266](https://github.com/tounsoo/todae/pull/266))

## 0.4.0

### Minor Changes

- Add `Contents`, an "On this page" list that marks the section being read with `aria-current="location"`. ([#218](https://github.com/tounsoo/todae/pull/218))
  
  - `Strings` has a new key, `contents`, the name of `Contents.Root` without a label; add it to an object you type as a complete `Strings`.

- CodeBlock.Root no longer has the browser's default `pre` margin. ([#212](https://github.com/tounsoo/todae/pull/212))
  
  - A `CodeBlock.Root` outside Prose now touches what is above and below it; space it with a `Stack.Root` or a margin of your own.

- Button.Root with `aria-disabled="true"` now looks disabled, keeps focus, and ignores clicks. ([#214](https://github.com/tounsoo/todae/pull/214))
  
  - `Button.Root` with `aria-disabled="true"` no longer calls `onClick`, flips a toggle, submits a form or follows a link, and `Composer.Root` sends nothing on Enter while its send button has it; drop guards in your own handlers.

- DataList.Root takes `minItemSize` to lay its items out in columns, spaced by the new `datalist.gap.between-columns` token. ([#208](https://github.com/tounsoo/todae/pull/208))
  
  - Grid.Root's inline custom properties are now the private `--_column-count` and `--_min-item-size`, so CSS that set `--todae-grid-column-count` or `--todae-grid-min-item-size` no longer applies; set the `columns` or `minItemSize` prop instead.

- Add Drilldown, a stack of views with focus, Escape and back-gesture handling inside Dialog, Drawer, BottomSheet and Popover. ([#216](https://github.com/tounsoo/todae/pull/216))
  
  - `Strings` has two new keys, `back` and `backTo` (`(label: string) => string`); add them to an object you type as a complete `Strings`.

- Calendar.Root takes mode="range", and Field.DateRangePicker, formatDateRange and parseDateRange pick and type a range of dates. ([#205](https://github.com/tounsoo/todae/pull/205))
  
  - `CalendarRootProps` is a union on `mode`; narrow it by `mode` before reading `value`, `defaultValue` or `onValueChange` in a wrapper's own types.
  - `Strings` has two new keys, `dateRangePicker` and `pickEndDate`; add them to an object you type as a complete `Strings`.

- `Tooltip.Root` renders a `<span>` instead of a `<div>`, so a trigger and its tip can sit inside a paragraph, and logs a development error for block content in a tip. ([#210](https://github.com/tounsoo/todae/pull/210))
  
  - `Tooltip.Root` and its tip are `<span>` elements, and its props and ref are a span's; retype an `HTMLDivElement` ref as `HTMLSpanElement`, and move CSS that selects them as `div`.
  - A tip that holds block content, such as a `<p>` or `<div>`, logs a development error; keep a tip's content to phrasing content.

### Patch Changes

- Add `todae-tokens build --scope <selector>` for themes that apply to part of a page, and have failed token builds name the fix, including the nearest lightness that passes an APCA pair. ([#213](https://github.com/tounsoo/todae/pull/213))

- `Disclosure.Summary` from the main entry takes focus when code closes its disclosure while the content holds focus. ([#211](https://github.com/tounsoo/todae/pull/211))

- Text.Root takes `size="label"` for eyebrows and metadata, styled by the new `text.label.*` tokens. ([#209](https://github.com/tounsoo/todae/pull/209))

- Add useFocusHandoff, which moves focus to a given element when the element it watches unmounts while holding focus. ([#212](https://github.com/tounsoo/todae/pull/212))

- `Tooltip.Root` no longer logs the same content error on every render. ([#217](https://github.com/tounsoo/todae/pull/217))

- Escape goes to the innermost open Popover, Menu or Tooltip by DOM nesting, not only to the one opened last, and a Dialog, Drawer or BottomSheet's close requests, such as the Android back gesture, go to the innermost open Popover or Menu inside it first. ([#216](https://github.com/tounsoo/todae/pull/216))

## 0.3.0

### Minor Changes

- Adds Field.NumberInput with Field.Increment and Field.Decrement, and removes Field.TextInput type="number". ([#202](https://github.com/tounsoo/todae/pull/202))
  
  - `Field.TextInput type="number"` is gone; use `Field.NumberInput`, whose value is a `number | null`, and which reads and writes the locale's format. A JavaScript caller that still passes `type="number"` gets a development warning and a native number input.
  - `Strings` has two new keys, `increment` and `decrement`, which are given the text of the field's label (`(field: string) => string`, with `field` empty without a label); add them to an object you type as a complete `Strings`.
  - `Glyphs` has two new keys, `plus` and `minus`; add them to an object you type as `Required<Glyphs>`.

- Chip.Overflow is removed; a +N count is a plain `Chip.Root`. ([#194](https://github.com/tounsoo/todae/pull/194))
  
  - Replace `<Chip.Overflow overflowCount={n} />` with a `Chip.Root` holding the text, such as `<Chip.Root aria-hidden>+4</Chip.Root>`, and a `VisuallyHidden.Root` holding its name, such as `moreChips(n)` from `useStrings`. `ChipOverflowProps` is gone, and a +N chip no longer has a dashed border.

- Code.Block is now its own component, `CodeBlock.Root`, with a server entry at `@tounsoo/todae/code-block`. ([#192](https://github.com/tounsoo/todae/pull/192))
  
  - Replace `<Code.Block>` with `<CodeBlock.Root>`, and the `CodeBlockProps` type with `CodeBlockRootProps`.

- Field.DatePicker, Field.TimePicker, Field.DateTimePicker and Field.ChipInput carry their value in a validated input, with required, min and max, and useField().getValueInputProps with notifyValueChange does so for custom controls. ([#197](https://github.com/tounsoo/todae/pull/197))
  
  - A picker with `min` or `max` now blocks a submit, and shows a problem in `Form.Root`, when its value is outside them; give a value in range, or drop the bound.
  - `required` on `Field.ChipInput` now needs at least one chip, not text in the input.
  - `Strings` has three new keys, `required`, `dateRangeUnderflow` and `dateRangeOverflow`; add them to an object you type as a complete `Strings`.

- Add `role="alertdialog"` to `Dialog.Root`, which keeps backdrop clicks from closing it and focuses its `Dialog.Close` on open. ([#196](https://github.com/tounsoo/todae/pull/196))
  
  - `Dialog.Root role="alertdialog"` no longer closes on a backdrop click and focuses its first `Dialog.Close`; pass `dismissOnBackdrop` or `initialFocusRef` to keep the old behavior.
  - `Dialog.Root`'s `role` takes only `'dialog'` or `'alertdialog'`.
  - `Drawer.Root` no longer takes `role`; remove it.

- A nested ThemeProvider or DensityProvider that sets no value keeps the enclosing provider's. ([#187](https://github.com/tounsoo/todae/pull/187))
  
  - A nested ThemeProvider that relied on resetting its subtree to `system` now needs `appearance="system"`.
  - A nested DensityProvider that relied on resetting its subtree to `comfortable` now needs `density="comfortable"`.

### Patch Changes

- useCombobox passes onCreate an AbortSignal, reads a falsy failure, or a load that throws, as an Error (useMentions loads too), reports a throw after an async create with reportError, and leaves Escape on a closed list with nothing to clear to the page; overlay initial focus matches Tab: a named radio group has one stop, and a checked radio of that name outside the overlay takes the group out of it. ([#191](https://github.com/tounsoo/todae/pull/191))

- Adds Form.Root and Form.Summary for native form validation. ([#195](https://github.com/tounsoo/todae/pull/195))

- Field.TextInput and Field.Textarea take `onValueChange` without `onChange`, and are `readOnly` with neither. ([#187](https://github.com/tounsoo/todae/pull/187))

- todae-tokens names the Todae set, modifier or variant context that a misplaced company token belongs in. ([#187](https://github.com/tounsoo/todae/pull/187))

- The token catalog's `entry` has a `context` field for a button variant's tokens, such as `"primary"`. ([#193](https://github.com/tounsoo/todae/pull/193))

- ThemeProvider overrides accept oklch components held in a readonly array, such as an `as const` constant. ([#187](https://github.com/tounsoo/todae/pull/187))

- Add DataList: a dl of terms and details, beside each other or stacked. ([#200](https://github.com/tounsoo/todae/pull/200))

- Add `Table.SortButton`, `Table.HeaderCell` `sort`, `Table.Row` `selected`, `Checkbox.Root` `indeterminate` and the `useSelection` hook. ([#201](https://github.com/tounsoo/todae/pull/201))

- Each tokens.json row names the set or modifier that declares the token in `entry`. ([#187](https://github.com/tounsoo/todae/pull/187))

- Add Avatar.Group, a group of Avatar.Root avatars that overlap and share one size. ([#199](https://github.com/tounsoo/todae/pull/199))

- Add EmptyState: what a list, table or search shows when it has nothing, with an icon, title, description and actions. ([#198](https://github.com/tounsoo/todae/pull/198))

## 0.2.0

### Minor Changes

- useCombobox names its listbox by the field's Label. ([#184](https://github.com/tounsoo/todae/pull/184))
  
  - Spread `getLabelProps()` on the Label, or pass `aria-label` to `getListboxProps()`.
  - `getTriggerProps().ref` is a callback ref; read `cb.triggerRef` for the element.
  - Enter with nothing to pick now reaches the form and creates nothing; handle it there if you relied on it creating.
  - `Field.ChipInput`'s `onCommit` returns `boolean | void`; return nothing, or `false` to let the key through.
  - `ComboboxCloseReason` adds `'reset'`; add a case to a `switch` that checks every reason.
  - An `OptionList.Option` with `aria-disabled` stays reachable but can't be selected; remove the attribute from options people should pick.

- A `preventDefault()` in a trigger's handler now stops what the trigger does. ([#179](https://github.com/tounsoo/todae/pull/179))
  
  - A `preventDefault()` in the `onClick` on a `usePopover` trigger or a `Field` picker button stops the toggle; drop it where the toggle should still happen.
  - A `preventDefault()` in the `onPointerEnter` or `onFocus` on a `useTooltip` trigger or `Button.Root` stops the tip; drop it where the tip should still show.
  - Make an `<a href>` trigger whose `onClick` calls `preventDefault()` a `<button>`.

### Patch Changes

- useCombobox reports async creates with `creating` and `createError`, and `reset()` runs the change callbacks, giving a controlled owner the `default*` props. ([#184](https://github.com/tounsoo/todae/pull/184))

- Change callbacks run only when their part changes, so picking the selected option again no longer calls `onValueChange`. A held Enter commits once. ([#184](https://github.com/tounsoo/todae/pull/184))

- useCombobox and `Field.ChipInput` leave IME composition keys to the input, and useMentions and Composer no longer ignore arrows, Escape or Backspace that carry `keyCode` 229 outside a composition. ([#184](https://github.com/tounsoo/todae/pull/184))

- A sheet or dialog trigger is named by its Label and its text. ([#184](https://github.com/tounsoo/todae/pull/184))

- Dialog, Drawer and BottomSheet focus `initialFocusRef` when opened after mount. Without it, first focus skips hidden and negative-`tabindex` controls and can land on an iframe, a media player or a contenteditable. ([#181](https://github.com/tounsoo/todae/pull/181))

- A slow BottomSheet drag to the bottom dismisses it. ([#181](https://github.com/tounsoo/todae/pull/181))

- ScrollArea and Conversation.Viewport take a Tab stop when no control inside can take focus, and Toolbar's arrow keys skip controls under `aria-hidden`. ([#181](https://github.com/tounsoo/todae/pull/181))

- `Button.Root` keeps your `aria-describedby` with its automatic tooltip, and it and `useTooltip` add the tip's id while the tip is open. ([#179](https://github.com/tounsoo/todae/pull/179))

- Button.Root, Menu.Item and Toast.Action take a `render` prop, so a link can look like a button or be a menu item. ([#180](https://github.com/tounsoo/todae/pull/180))

- Keys choose a menu item through a click, so its `onClick` runs for Enter and Space and `preventDefault()` stops them. ([#180](https://github.com/tounsoo/todae/pull/180))

- A disabled Menu.Item runs no `onClick`, and Ctrl, Cmd or Shift with Enter reaches a menu item's click. ([#185](https://github.com/tounsoo/todae/pull/185))

- A link in a Button.Group gets the group's corners, and a wrapper typed with `ToastActionProps` can pass its props to Toast.Action. ([#185](https://github.com/tounsoo/todae/pull/185))

## 0.1.0

### Minor Changes

- First public release: React components, headless hooks, DTCG design tokens with the `todae-tokens` builder, the `todae.css` stylesheet and a component schema. ([#171](https://github.com/tounsoo/todae/pull/171))
