import { createContext, useCallback, useContext, useLayoutEffect, useRef, type RefObject } from 'react';

type CountEntry = { value: string; maxLength?: number };

export type CountStore = {
  entry: CountEntry | null;
  counters: number;
  /** Elements wired with useField's getControlProps, other than a Field.ColorPicker's or Field.DatePicker's, mounted in the field. */
  controls: number;
  /** Of those, the ones whose name attribute is the field's name. */
  named: number;
  /** Of those, date inputs, which hold a Field.DatePicker's value. */
  dates: number;
  listeners: Set<() => void>;
  presence: Set<() => void>;
};

export type FieldContextValue = {
  inputId: string;
  hintId: string;
  disabled: boolean;
  invalid: boolean;
  name?: string;
  describedBy?: string;
  labelledBy?: string;
  ariaLabel?: string;
  /** The control the shell focuses on a press outside it. */
  inputRef: RefObject<HTMLElement | null>;
  /** The shell element. */
  shellRef: RefObject<HTMLDivElement | null>;
  store: CountStore;
};

function notifyPresence(store: CountStore) {
  for (const listener of store.presence) listener();
}

/**
 * A stable ref callback that counts the element it is attached to as a
 * control in the field, and as named when its name attribute is the field's
 * name. A Field.ColorPicker beside a control gives up the field's id and
 * description, and beside a named one the field's name, so only one element
 * takes each. A date input is also counted in `dates`, so a Field.DatePicker
 * beside one shows no date text. The count follows the element and its name after each commit,
 * so a control that is not rendered, or a component that only reads
 * useField, does not count.
 */
export function useControlPresence(
  store: CountStore,
  fieldName: string | undefined,
  counted: boolean,
): (node: HTMLElement | null) => void {
  const node = useRef<HTMLElement | null>(null);
  const name = useRef(fieldName);
  const own = useRef({ control: false, named: false, date: false });
  const sync = useCallback(() => {
    const el = counted ? node.current : null;
    const next = {
      control: el !== null,
      named: el !== null && Boolean(name.current) && el.getAttribute('name') === name.current,
      date: el instanceof HTMLInputElement && el.type === 'date',
    };
    const prev = own.current;
    if (next.control === prev.control && next.named === prev.named && next.date === prev.date) return;
    store.controls += Number(next.control) - Number(prev.control);
    store.named += Number(next.named) - Number(prev.named);
    store.dates += Number(next.date) - Number(prev.date);
    own.current = next;
    notifyPresence(store);
  }, [store, counted]);
  // After each commit: the element's name can change, from its own name prop or the Root's.
  useLayoutEffect(() => {
    name.current = fieldName;
    sync();
  });
  return useCallback(
    (el: HTMLElement | null) => {
      node.current = el;
      sync();
    },
    [sync],
  );
}

export const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error('Field parts must be rendered inside Field.Root');
  return ctx;
}

/** The elements a press on the shell can focus. */
export const FIELD_CONTROL_SELECTOR = 'input, textarea, select, [data-todae-field-control]';

/** Of those, the ones a press can actually focus. */
export const FOCUSABLE_FIELD_CONTROL_SELECTOR =
  "input:not([type='hidden']):not(:disabled), textarea:not(:disabled), select:not(:disabled), [data-todae-field-control]:not(:disabled):not([aria-disabled='true'])";

/**
 * A stable ref callback that makes a control the one the shell focuses. On
 * detach it clears the Root's ref only if it still points at this control, so
 * another control under the same Root keeps it.
 */
export function useControlSetter(inputRef: RefObject<HTMLElement | null>): (node: HTMLElement | null) => void {
  const own = useRef<HTMLElement | null>(null);
  return useCallback(
    (node: HTMLElement | null) => {
      if (node) inputRef.current = node;
      else if (inputRef.current === own.current) inputRef.current = null;
      own.current = node;
    },
    [inputRef],
  );
}

export function mergeDescribedBy(root?: string, own?: string, hint?: string) {
  const ids = [root, own, hint].filter((id): id is string => Boolean(id));
  return ids.length > 0 ? ids.join(' ') : undefined;
}

type LabelAttrs = { 'aria-label'?: string; 'aria-labelledby'?: string };

/**
 * An input that names itself keeps both of its own label attributes and takes
 * neither from the Root: a Root `aria-labelledby` would outrank the input's
 * own `aria-label`.
 */
export function inputLabel(own: LabelAttrs, field: { ariaLabel?: string; labelledBy?: string }): LabelAttrs {
  if (own['aria-label'] != null || own['aria-labelledby'] != null) {
    return { 'aria-label': own['aria-label'], 'aria-labelledby': own['aria-labelledby'] };
  }
  return { 'aria-label': field.ariaLabel, 'aria-labelledby': field.labelledBy };
}
