import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type RefCallback,
} from 'react';
import { activeIn } from '../components/activeElement.js';
import { isImeKeyEvent } from '../components/ime.js';
import { useComposedRefs } from '../components/props.js';
import { handledOrComposing, useEscapeKey } from '../overlay/useEscapeKey.js';
import { useFocusHandoff } from './useFocusHandoff.js';

export type UseInlineEditOptions = {
  /** The saved value. Each edit starts from it. */
  value: string;
  /** Called with the draft when the person saves: Enter, a Save button that calls commit, or focus leaving the edit. Return false to keep editing, such as for an empty name; when focus left the edit, false puts the value back and calls onCancel. Not called when the draft equals value; the edit just closes. */
  onCommit: (draft: string) => boolean | void;
  /** Called when the person cancels: Escape, or a Cancel button that calls cancel. Also called when focus leaves the edit with a draft onCommit turns down. */
  onCancel?: () => void;
};

export type UseInlineEditTriggerProps = {
  ref: RefCallback<HTMLElement>;
  onClick: () => void;
};

export type UseInlineEditGroupProps = {
  ref: RefCallback<HTMLElement>;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
  onMouseDown: (event: MouseEvent<HTMLElement>) => void;
};

export type UseInlineEditInputProps = {
  ref: RefCallback<HTMLInputElement>;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

export type UseInlineEditResult = {
  /** True while the edit is open. */
  editing: boolean;
  /** The text in the input while editing. */
  draft: string;
  setDraft: (draft: string) => void;
  /** Opens the edit with `draft`, value by default, then focuses the input and selects its text. Does nothing while editing. */
  start: (draft?: string) => void;
  /** Saves the draft through onCommit and closes the edit, unless onCommit returns false. */
  commit: () => void;
  /** Calls onCancel and closes the edit. */
  cancel: () => void;
  /** Props for the button that starts the edit, such as Rename. Focus returns to it when the edit closes. */
  getTriggerProps: () => UseInlineEditTriggerProps;
  /** Props for the element that holds the input and its Save and Cancel buttons while editing. Render it only while editing: focus returns to the trigger as it unmounts. */
  getGroupProps: () => UseInlineEditGroupProps;
  /** Props for the text input. */
  getInputProps: () => UseInlineEditInputProps;
};

type Edit = { editing: boolean; draft: string };

/**
 * Edits a value in place, such as a name in a list. Enter saves and Escape
 * cancels, both left alone while an IME composition is open; focus leaving
 * the group saves too, or cancels when onCommit turns the draft down. When the
 * edit closes with focus inside it, focus returns to the trigger.
 */
export function useInlineEdit({ value, onCommit, onCancel }: UseInlineEditOptions): UseInlineEditResult {
  const [edit, setEdit] = useState<Edit>({ editing: false, draft: '' });
  // The edit as handlers last set it, so an Enter and the blur that follows
  // as the group unmounts commit once.
  const live = useRef(edit);
  const latest = useRef({ value, onCommit, onCancel });
  latest.current = { value, onCommit, onCancel };
  const trigger = useRef<HTMLElement | null>(null);
  const group = useRef<HTMLElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  const update = useCallback((next: Edit) => {
    live.current = next;
    setEdit(next);
  }, []);

  const start = useCallback(
    (draft?: string) => {
      if (live.current.editing) return;
      update({ editing: true, draft: draft ?? latest.current.value });
    },
    [update],
  );

  const setDraft = useCallback((draft: string) => update({ ...live.current, draft }), [update]);

  const close = useCallback(() => update({ ...live.current, editing: false }), [update]);

  const cancel = useCallback(() => {
    if (!live.current.editing) return;
    latest.current.onCancel?.();
    close();
  }, [close]);

  const save = useCallback(
    (fromBlur: boolean) => {
      const { editing, draft } = live.current;
      if (!editing) return;
      if (draft !== latest.current.value && latest.current.onCommit(draft) === false) {
        // Focus has gone elsewhere, where Escape can't reach the edit, so a
        // draft turned down as focus leaves puts the value back.
        if (fromBlur) return cancel();
        // A Save button that took focus by the keyboard gives it back to the
        // input, so the person can fix the text.
        const el = group.current;
        if (el?.contains(activeIn(el))) input.current?.focus();
        return;
      }
      close();
    },
    [cancel, close],
  );

  const commit = useCallback(() => save(false), [save]);

  // Escape and a modal's close requests, such as the Android back gesture,
  // come through the overlays' Escape stack, so an edit in a Dialog cancels
  // before the dialog closes.
  const takes = useCallback((target: Element | null) => group.current?.contains(target) === true, []);
  useEscapeKey(edit.editing, takes, cancel, group, { popup: false, passesKey: handledOrComposing });

  const handoff = useFocusHandoff({ to: trigger });
  const groupRef = useComposedRefs<HTMLElement>(group, handoff);
  // A callback ref, which fits a button as well as any other element.
  const triggerRef = useCallback((el: HTMLElement | null) => {
    trigger.current = el;
  }, []);
  const inputRef = useCallback((el: HTMLInputElement | null) => {
    input.current = el;
  }, []);

  useLayoutEffect(() => {
    if (!edit.editing) return;
    input.current?.focus();
    input.current?.select();
  }, [edit.editing]);

  const getTriggerProps = (): UseInlineEditTriggerProps => ({ ref: triggerRef, onClick: () => start() });

  const getGroupProps = (): UseInlineEditGroupProps => ({
    ref: groupRef,
    onBlur: (event) => {
      // A blur as the group unmounts after a commit or cancel.
      if (!live.current.editing) return;
      const el = event.currentTarget;
      const next = event.relatedTarget;
      if (next instanceof Node && el.contains(next)) return;
      // No new target and no focus in the document: the window or tab lost
      // focus, and the person may come back to the edit.
      if (next === null && !el.ownerDocument.hasFocus()) return;
      save(true);
    },
    onMouseDown: (event) => {
      // Safari and Firefox on macOS don't focus a clicked button, so focus
      // would leave the group and save before Cancel's click. Keeping it in
      // the input saves or cancels by the button pressed.
      // Anywhere but a field, so a press on the gap or the error text doesn't
      // take focus to the page and save either.
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) event.preventDefault();
    },
  });

  const getInputProps = (): UseInlineEditInputProps => ({
    ref: inputRef,
    value: edit.draft,
    onChange: (event) => setDraft(event.target.value),
    onKeyDown: (event) => {
      if (event.key !== 'Enter' || event.defaultPrevented || isImeKeyEvent(event)) return;
      // An enclosing form would submit on Enter.
      event.preventDefault();
      commit();
    },
  });

  return {
    editing: edit.editing,
    draft: edit.draft,
    setDraft,
    start,
    commit,
    cancel,
    getTriggerProps,
    getGroupProps,
    getInputProps,
  };
}
