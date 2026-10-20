# @tounsoo/todae

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
