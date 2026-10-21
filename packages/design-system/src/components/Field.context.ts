import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from 'react';
import { warnOnce } from './warnOnce.js';

type CountEntry = { value: string; maxLength?: number };

/**
 * What a Field.NumberInput tells Field.Increment and Field.Decrement, which
 * find it through the field rather than by its type. A new object only when
 * something they show changes.
 */
export type StepperEntry = {
  /** Steps the number by one step up or down, as the arrow keys do. */
  step: (direction: 1 | -1) => void;
  /** The id of the input, for `aria-controls`. */
  inputId: string;
  /** What names the input, such as its label's text, for a button's name. Empty without one. */
  label: string;
  /** The field is disabled or read-only. */
  disabled: boolean;
  atMin: boolean;
  atMax: boolean;
};

export type CountStore = {
  entry: CountEntry | null;
  counters: number;
  /** Elements wired with useField's getControlProps, other than a Field.ColorPicker's, Field.DatePicker's, Field.TimePicker's or Field.DateTimePicker's, mounted in the field. */
  controls: number;
  /** Of those, the ones getControlProps gave the field's name. */
  named: number;
  listeners: Set<() => void>;
  presence: Set<() => void>;
  stepper: StepperEntry | null;
  steppers: Set<() => void>;
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

function notify(listeners: Set<() => void>) {
  for (const listener of listeners) listener();
}

/** A `subscribe` for `useSyncExternalStore` over one of the store's listener sets. */
const subscribeTo = (listeners: Set<() => void>) => (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * A stable ref callback that counts the element it is attached to as a
 * control in the field, and as named when getControlProps gave it the field's
 * name. A Field.ColorPicker, Field.DatePicker, Field.TimePicker or Field.DateTimePicker beside a control gives up the
 * field's id and description, and beside a named one the field's name, so only
 * one element takes each. The count follows the
 * element after each commit, so a control that is not rendered, or a component
 * that only reads useField, does not count.
 */
export function useControlPresence(
  store: CountStore,
  counted: boolean,
): { setPresence: (node: HTMLElement | null) => void; ownNamed: () => number } {
  const node = useRef<HTMLElement | null>(null);
  const own = useRef({ control: false, named: false });
  const sync = useCallback(() => {
    const el = counted ? node.current : null;
    const next = {
      control: el !== null,
      named: el?.getAttribute('data-todae-field-control') === 'name',
    };
    const prev = own.current;
    if (next.control === prev.control && next.named === prev.named) return;
    store.controls += Number(next.control) - Number(prev.control);
    store.named += Number(next.named) - Number(prev.named);
    own.current = next;
    notify(store.presence);
  }, [store, counted]);
  // After each commit: whether the element took the field's name can change.
  useLayoutEffect(() => sync());
  const setPresence = useCallback(
    (el: HTMLElement | null) => {
      node.current = el;
      sync();
    },
    [sync],
  );
  const ownNamed = useCallback(() => Number(own.current.named), []);
  return { setPresence, ownNamed };
}

/**
 * One yes-or-no fact about the controls the field holds. It is the snapshot
 * itself, a boolean, so a part re-renders only when the fact flips, not each
 * time another control mounts. The server cannot know of a control yet, so it
 * reads false until hydration.
 */
function useStoreFlag(store: CountStore, read: (store: CountStore) => boolean): boolean {
  const subscribe = useMemo(() => subscribeTo(store.presence), [store]);
  return useSyncExternalStore(
    subscribe,
    () => read(store),
    () => false,
  );
}

const hasControl = (store: CountStore) => store.controls > 0;

/** Whether any control wired with useField is in the field, for a part that leaves the field's id and description to it. */
export const useBesideControl = (store: CountStore) => useStoreFlag(store, hasControl);

/**
 * Whether useField gave another control the field's name, for a part that leaves the name to it.
 * `own` is what this part's own control adds to that count: a control that took
 * the name itself reads false, so its own mount flips nothing and costs no second commit.
 */
export const useBesideNamed = (store: CountStore, own: () => number) =>
  useStoreFlag(store, (current) => current.named - own() > 0);

/**
 * Publishes a Field.NumberInput's entry to the field's store, for
 * Field.Increment and Field.Decrement. One input's entry replaces another's,
 * with a warning in development, and an input that goes away takes down only
 * its own entry, so the one that replaced it is left.
 */
export function usePublishStepper(store: CountStore, entry: StepperEntry): void {
  const published = useRef<StepperEntry | null>(null);
  useLayoutEffect(() => {
    if (store.stepper && store.stepper !== published.current) {
      warnOnce('number-input-twice', 'Field.Root holds more than one Field.NumberInput, so Field.Increment and Field.Decrement step only the last one. Give each its own Field.Root.');
    }
    published.current = entry;
    store.stepper = entry;
    notify(store.steppers);
  }, [store, entry]);
  useLayoutEffect(
    () => () => {
      if (store.stepper !== published.current) return;
      store.stepper = null;
      notify(store.steppers);
    },
    [store],
  );
}

/** The entry of the field's Field.NumberInput, or null while it has none. */
export function useStepper(store: CountStore): StepperEntry | null {
  const subscribe = useMemo(() => subscribeTo(store.steppers), [store]);
  return useSyncExternalStore(
    subscribe,
    () => store.stepper,
    () => null,
  );
}

export const FieldContext = /* @__PURE__ */ createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error('Field parts must be rendered inside Field.Root');
  return ctx;
}

/** The elements a press on the shell can focus. */
export const FIELD_CONTROL_SELECTOR = 'input, textarea, select, [data-todae-field-control]';

/** Of those, the ones a press can actually focus. */
export const FOCUSABLE_FIELD_CONTROL_SELECTOR =
  "input:not([type='hidden']):not([data-todae-value-input]):not(:disabled), textarea:not(:disabled), select:not(:disabled), [data-todae-field-control]:not(:disabled):not([aria-disabled='true'])";

/**
 * A stable ref callback that makes a control the one the shell focuses. An
 * uncounted control, such as a picker's button, takes it only while no counted
 * control is in the field, so one beside it keeps it whichever mounts first.
 * On detach it clears the Root's ref only if it still points at this control,
 * so another control under the same Root keeps it. When the last counted
 * control unmounts, the field has no focus target until a control mounts or
 * renders again: a picker left alone still opens from its own button.
 */
export function useControlSetter(
  inputRef: RefObject<HTMLElement | null>,
  store: CountStore,
  counted: boolean,
): (node: HTMLElement | null) => void {
  const own = useRef<HTMLElement | null>(null);
  return useCallback(
    (node: HTMLElement | null) => {
      if (node) {
        if (counted || store.controls === 0) inputRef.current = node;
      } else if (inputRef.current === own.current) inputRef.current = null;
      own.current = node;
    },
    [counted, inputRef, store],
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
