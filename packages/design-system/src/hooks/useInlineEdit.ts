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
import { activeIn, focusLost } from '../components/activeElement.js';
import { isImeKeyEvent } from '../components/ime.js';
import { useEscapeKey } from '../overlay/useEscapeKey.js';

export type UseInlineEditOptions = {
  /** The saved value. Each edit starts from it. */
  value: string;
  /** Called with the draft when the person saves: Enter, a Save button that calls commit, or focus leaving the edit. Return false to keep editing, such as for an empty name. Not called when the draft equals value; the edit just closes. */
  onCommit: (draft: string) => boolean | void;
  /** Called when the person cancels: Escape, or a Cancel button that calls cancel. */
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
  /** Opens the edit with `draft`, value by default, then focuses the input and selects its text. */
  start: (draft?: string) => void;
  /** Saves the draft through onCommit and closes the edit, unless onCommit returns false. */
  commit: () => void;
  /** Calls onCancel and closes the edit. */
  cancel: () => void;
  /** Props for the button that starts the edit, such as Rename. Focus returns to it when the edit closes. */
  getTriggerProps: () => UseInlineEditTriggerProps;
  /** Props for the element that holds the input and its Save and Cancel buttons while editing. */
  getGroupProps: () => UseInlineEditGroupProps;
  /** Props for the text input. */
  getInputProps: () => UseInlineEditInputProps;
};

type Edit = { editing: boolean; draft: string; opened: number };

/**
 * Edits a value in place, such as a name in a list. Enter saves and Escape
 * cancels, both left alone while an IME composition is open; focus leaving
 * the group saves too. When the edit closes with focus inside it, focus
 * returns to the trigger.
 */
export function useInlineEdit({ value, onCommit, onCancel }: UseInlineEditOptions): UseInlineEditResult {
  const [edit, setEdit] = useState<Edit>({ editing: false, draft: '', opened: 0 });
  // The edit as handlers last set it, so an Enter and the blur that follows
  // as the group unmounts commit once.
  const live = useRef(edit);
  const latest = useRef({ value, onCommit, onCancel });
  latest.current = { value, onCommit, onCancel };
  const trigger = useRef<HTMLElement | null>(null);
  const group = useRef<HTMLElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const returnFocus = useRef(false);

  const update = useCallback((next: Edit) => {
    live.current = next;
    setEdit(next);
  }, []);

  const start = useCallback(
    (draft?: string) => update({ editing: true, draft: draft ?? latest.current.value, opened: live.current.opened + 1 }),
    [update],
  );

  const setDraft = useCallback((draft: string) => update({ ...live.current, draft }), [update]);

  const close = useCallback(
    (fromBlur: boolean) => {
      const el = group.current;
      returnFocus.current = !fromBlur && el !== null && el.contains(activeIn(el));
      update({ ...live.current, editing: false });
    },
    [update],
  );

  const save = useCallback(
    (fromBlur: boolean) => {
      const { editing, draft } = live.current;
      if (!editing) return;
      if (draft !== latest.current.value && latest.current.onCommit(draft) === false) {
        // Turned down: a Save button that took focus by the keyboard gives it
        // back to the input, so the person can fix the text.
        const el = group.current;
        if (!fromBlur && el?.contains(activeIn(el))) input.current?.focus();
        return;
      }
      close(fromBlur);
    },
    [close],
  );

  const commit = useCallback(() => save(false), [save]);

  const cancel = useCallback(() => {
    if (!live.current.editing) return;
    latest.current.onCancel?.();
    close(false);
  }, [close]);

  // Escape and a modal's close requests, such as the Android back gesture,
  // come through the overlays' Escape stack, so an edit in a Dialog cancels
  // before the dialog closes.
  const takes = useCallback((target: Element | null) => group.current?.contains(target) === true, []);
  useEscapeKey(edit.editing, takes, cancel, group, { popup: false, passesKey: handledOrComposing });

  useLayoutEffect(() => {
    if (edit.opened === 0 || !live.current.editing) return;
    input.current?.focus();
    input.current?.select();
  }, [edit.opened]);

  useLayoutEffect(() => {
    if (edit.editing || !returnFocus.current) return;
    returnFocus.current = false;
    // Once the commit is done, as useFocusHandoff does, so the trigger has
    // mounted and its onFocus handlers run.
    queueMicrotask(() => {
      const el = trigger.current;
      if (el?.isConnected && focusLost(el.ownerDocument)) el.focus();
    });
  }, [edit.editing]);

  const triggerRef = useCallback((el: HTMLElement | null) => {
    trigger.current = el;
  }, []);
  const groupRef = useCallback((el: HTMLElement | null) => {
    group.current = el;
  }, []);
  const inputRef = useCallback((el: HTMLInputElement | null) => {
    input.current = el;
  }, []);

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
      if (input.current && !input.current.contains(event.target as Node)) event.preventDefault();
    },
  });

  const getInputProps = (): UseInlineEditInputProps => ({
    ref: inputRef,
    value: edit.draft,
    onChange: (event) => setDraft(event.target.value),
    onKeyDown: (event) => {
      if (event.key !== 'Enter' || isImeKeyEvent(event)) return;
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

// A key a popup or field inside already took, or one that ends an IME composition.
function handledOrComposing(event: globalThis.KeyboardEvent): boolean {
  return event.defaultPrevented || isImeKeyEvent(event);
}
