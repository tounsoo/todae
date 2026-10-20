# @tounsoo/todae

## 0.2.0

### Minor Changes

- [#184](https://github.com/tounsoo/todae/pull/184) [`e231e63`](https://github.com/tounsoo/todae/commit/e231e631e51b015c42be2425f965366b9b43df63) Thanks [@tounsoo](https://github.com/tounsoo)! - Breaking:
  
  - useCombobox names its listbox by the field's Label, so spread the new `getLabelProps()` on it (or pass `aria-label` to `getListboxProps()`).
  - `getTriggerProps().ref` is now a callback ref, so read `cb.triggerRef` for the element.
  - Enter with nothing to pick, on a closed list or on an open list with no rows, goes to the form and creates nothing.
  - `Field.ChipInput`'s `onCommit` now returns `boolean | void`, so a callback that returns another value, such as `(v) => list.push(v)`, no longer type-checks. Return nothing, or `false` to let the key through.
  - `ComboboxCloseReason` gains `'reset'`, so a `switch` over it that checks every reason needs a new case.
  - An `OptionList.Option` with `aria-disabled` stays reachable, and a click makes it active, but it can no longer be selected.
  
  Also:
  
  - `creating` and `createError` report async creates. `onCreate` runs once per label while its create is pending. A pick, `clear()` or `reset()` drops a pending create, and running its label again takes it back.
  - `reset()` goes through the change callbacks with the `'reset'` reason. A controlled owner gets the `default*` props, or empty values.
  - A change callback runs only when its part changes, so picking the option that is already selected no longer calls `onValueChange`.
  - A held Enter, or a held commit key in `Field.ChipInput`, commits once.
  - A sheet or dialog trigger is named by the Label and its text.
  - useCombobox and `Field.ChipInput` leave IME keys to the input, Safari's composition-ending Enter included. useMentions and Composer now treat `keyCode` 229 as part of a composition only on Enter, and on Tab in useMentions, so an arrow, Escape or Backspace that carries 229 outside a composition works.

- [#179](https://github.com/tounsoo/todae/pull/179) [`af3977a`](https://github.com/tounsoo/todae/commit/af3977a19309ccb6ac7d5664de8835d4a252e1ec) Thanks [@tounsoo](https://github.com/tounsoo)! - Breaking: a `preventDefault()` in the `onClick` you pass to `usePopover`'s trigger or a `Field` picker's button now stops it from toggling (a press elsewhere in the field still opens a picker that is the field's control), and one in the `onPointerEnter` or `onFocus` you pass to `useTooltip`'s trigger or `Button.Root` now stops the tip from showing. If your trigger is an `<a href>` whose `onClick` calls `preventDefault()`, make it a `<button>`.

### Patch Changes

- [#181](https://github.com/tounsoo/todae/pull/181) [`d4e5b1b`](https://github.com/tounsoo/todae/commit/d4e5b1b60bcc3105114ceeb1ad203b4ab5b65dd3) Thanks [@tounsoo](https://github.com/tounsoo)! - Dialog, Drawer and BottomSheet now focus `initialFocusRef` when opened after mount, and a slow BottomSheet drag all the way down now dismisses it. Without `initialFocusRef`, overlays now skip controls with a negative `tabindex`, hidden inputs, controls hidden by a stylesheet or a closed `<details>`, and controls under `aria-hidden="true"`, and they can land on an iframe, a media player with controls, or a contenteditable. They no longer skip the controls inside a non-form element that carries `disabled`, such as a `div`, since that never disabled anything; they still skip a disabled form control or the controls of a disabled fieldset. Tooltip's development warnings for text-only and links-only content now flag every control inside that is not disabled, even one that is hidden or has a negative `tabindex`.

- [#179](https://github.com/tounsoo/todae/pull/179) [`8cdfc37`](https://github.com/tounsoo/todae/commit/8cdfc37fa9a1a04702ae252444ba8d44d9435361) Thanks [@tounsoo](https://github.com/tounsoo)! - `Button.Root` keeps your `aria-describedby` while its automatic tooltip is on, and `Button.Root` and `useTooltip` add the tip's id to it while the tip is open.

- [#181](https://github.com/tounsoo/todae/pull/181) [`3bbf3e4`](https://github.com/tounsoo/todae/commit/3bbf3e4abe0d5246ea68cfee2a8a003fc8ef0c29) Thanks [@tounsoo](https://github.com/tounsoo)! - ScrollArea and Conversation.Viewport now take their own Tab stop when every control inside is hidden, has a negative `tabindex`, or sits under `aria-hidden="true"`, and count a `<video controls>` or `<audio controls>` as a control. They update when any attribute inside them changes, such as a class that hides a control; a stylesheet rule outside them that hides one is not seen until they resize. Toolbar's arrow keys skip a control under `aria-hidden="true"`, and Tab leaves a ChipList's overflow panel from its last shown control, whatever kind of control that is.

- [#180](https://github.com/tounsoo/todae/pull/180) [`dac04af`](https://github.com/tounsoo/todae/commit/dac04afefc61808d818e9e3e062dae80675fb078) Thanks [@tounsoo](https://github.com/tounsoo)! - Button.Root, Menu.Item and Toast.Action take a render prop, so a link can carry the button look or be a menu item. Keys now choose a menu item through a click, so its onClick runs for Enter and Space too, and an onClick that calls preventDefault() stops a key from choosing the item, as it already stopped a click.

- [#185](https://github.com/tounsoo/todae/pull/185) [`cfe6b3d`](https://github.com/tounsoo/todae/commit/cfe6b3d1476f1b1a998d4cca2f2dc46123e9e229) Thanks [@tounsoo](https://github.com/tounsoo)! - A disabled Menu.Item runs no onClick. Ctrl, Cmd or Shift with Enter on a menu item reaches its click, so a link item can open in a new tab. A link in a Button.Group gets the group's corners. A wrapper typed with ToastActionProps can pass its props to Toast.Action.

## 0.1.0

### Minor Changes

- [#171](https://github.com/tounsoo/todae/pull/171) [`79872f4`](https://github.com/tounsoo/todae/commit/79872f4224cde0cacf23ca3ed5bbeb43d51b7b0b) Thanks [@tounsoo](https://github.com/tounsoo)! - First public release. Todae ships React components, headless hooks, design tokens in DTCG format with the `todae-tokens` builder, the `todae.css` stylesheet, and a component schema.
