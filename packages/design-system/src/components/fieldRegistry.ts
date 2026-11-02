import { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { warnOnce } from '../internal/warnOnce.js';

/**
 * What a control is to its field. A `control` (anything wired with `useField`)
 * owns the field's id, description and focus. A `picker` (the button of
 * Field.ColorPicker, Field.DatePicker and every picker on PickerShell) owns
 * them only while no `control` is in the field.
 */
export type FieldControlRole = 'control' | 'picker';

/** One element a control wired with useField, as it registered. */
export type FieldControlEntry = {
  node: HTMLElement;
  role: FieldControlRole;
  /** It sends under the field's own name, so a value input beside it sends none. */
  takesName: boolean;
  /** A picker's: opens or closes its popover, for a press on the shell. */
  toggle?: () => void;
};

/** What a Field.TextInput or Field.Textarea tells Field.Counter. */
export type TextEntry = { value: string; maxLength?: number };

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

/**
 * Everything a `Field.Root` knows about the parts inside it, in one place:
 * which elements are its controls and who sends its name, the text a counter
 * counts, the number input step buttons reach, and its value inputs. Parts
 * register once, from a ref or a layout effect, never during render (the one
 * exception is `seedText`, below), and every reader subscribes through
 * `subscribe`. A reader asks a question whose answer is a boolean or a stable
 * object, so it re-renders only when that answer changes.
 */
export type FieldRegistry = {
  subscribe: (listener: () => void) => () => void;
  /** Registers, moves or, with null, removes `owner`'s control. A new node counts as the last to mount. */
  setControl: (owner: object, entry: FieldControlEntry | null) => void;
  /** Whether a `control`, as opposed to a picker, is in the field. */
  hasControl: () => boolean;
  /** Whether a control other than `except`'s took the field's name. */
  namedBy: (except?: object) => boolean;
  /** The element a press on the shell focuses: the last `control` to mount, else the last picker. */
  focusTarget: () => HTMLElement | null;
  /** The toggle of the picker whose button is `node`, if it is one. */
  toggleFor: (node: Element | null | undefined) => (() => void) | undefined;
  /** Counts a Field.Counter; the result uncounts it. */
  addCounter: () => () => void;
  hasCounter: () => boolean;
  /** Publishes, or with null withdraws, `owner`'s text. An owner withdraws only its own. */
  publishText: (owner: object, entry: TextEntry | null) => void;
  /** The text the counter counts, once committed. */
  text: () => TextEntry | null;
  /**
   * The text as a control rendered it, before any text is committed. The
   * server never commits, and hydration must render what the server did, so
   * Field.Counter's server snapshot reads this: the one write a render makes.
   * Nothing is notified, and once a text is committed it does nothing.
   */
  seedText: (entry: TextEntry) => void;
  serverText: () => TextEntry | null;
  /** Publishes `owner`'s stepper. Returns true when it replaced another owner's. */
  publishStepper: (owner: object, entry: StepperEntry) => boolean;
  /** Withdraws `owner`'s stepper, if it is still the one published. */
  withdrawStepper: (owner: object) => void;
  stepper: () => StepperEntry | null;
  /** Registers a value input of the field; the result unregisters it. */
  addValueInput: (input: HTMLInputElement) => () => void;
  /** The field's first value input in document order. */
  firstValueInput: () => HTMLInputElement | null;
};

function lastOf(entries: Iterable<FieldControlEntry>, role: FieldControlRole): HTMLElement | null {
  let found: HTMLElement | null = null;
  for (const entry of entries) if (entry.role === role) found = entry.node;
  return found;
}

const sameText = (a: TextEntry | null, b: TextEntry) => a !== null && a.value === b.value && a.maxLength === b.maxLength;

export function createFieldRegistry(): FieldRegistry {
  const listeners = new Set<() => void>();
  // Insertion order is mount order: a control that attaches again moves to the end.
  const controls = new Map<object, FieldControlEntry>();
  const valueInputs = new Set<HTMLInputElement>();
  let counters = 0;
  let text: { owner: object; entry: TextEntry } | null = null;
  let seed: TextEntry | null = null;
  // Whether a text was ever committed: from then on, render seeds nothing.
  let committed = false;
  let stepper: { owner: object; entry: StepperEntry } | null = null;
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setControl(owner, entry) {
      const prev = controls.get(owner);
      if (!entry) {
        if (!prev) return;
        controls.delete(owner);
      } else if (prev?.node === entry.node) {
        if (prev.role === entry.role && prev.takesName === entry.takesName && prev.toggle === entry.toggle) return;
        controls.set(owner, entry);
      } else {
        controls.delete(owner);
        controls.set(owner, entry);
      }
      notify();
    },
    hasControl: () => [...controls.values()].some((entry) => entry.role === 'control'),
    namedBy: (except) => [...controls].some(([owner, entry]) => owner !== except && entry.takesName),
    focusTarget: () => lastOf(controls.values(), 'control') ?? lastOf(controls.values(), 'picker'),
    toggleFor(node) {
      if (!node) return undefined;
      for (const entry of controls.values()) if (entry.node === node) return entry.toggle;
      return undefined;
    },
    addCounter() {
      counters += 1;
      notify();
      return () => {
        counters -= 1;
        notify();
      };
    },
    hasCounter: () => counters > 0,
    publishText(owner, entry) {
      if (!entry) {
        if (text?.owner !== owner) return;
        text = null;
      } else {
        if (text?.owner === owner && sameText(text.entry, entry)) return;
        // The seed the server rendered with, when it matches, so hydration's markup stays the same object.
        text = { owner, entry: sameText(seed, entry) ? seed! : entry };
        committed = true;
      }
      seed = null;
      notify();
    },
    text: () => text?.entry ?? null,
    seedText(entry) {
      if (committed || sameText(seed, entry)) return;
      seed = entry;
    },
    serverText: () => text?.entry ?? seed,
    publishStepper(owner, entry) {
      const replaced = stepper !== null && stepper.owner !== owner;
      if (stepper?.owner === owner && stepper.entry === entry) return false;
      stepper = { owner, entry };
      notify();
      return replaced;
    },
    withdrawStepper(owner) {
      if (stepper?.owner !== owner) return;
      stepper = null;
      notify();
    },
    stepper: () => stepper?.entry ?? null,
    addValueInput(input) {
      valueInputs.add(input);
      return () => {
        valueInputs.delete(input);
      };
    },
    firstValueInput() {
      let first: HTMLInputElement | null = null;
      for (const input of valueInputs) {
        if (!first || first.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_PRECEDING) first = input;
      }
      return first;
    },
  };
}

/**
 * One answer from the registry, re-read when it changes. The server knows of
 * no control, counter or stepper, since they register on commit, so `server`
 * defaults to the same question over the registry the server has.
 */
export function useRegistryValue<T>(
  registry: FieldRegistry,
  read: (registry: FieldRegistry) => T,
  server: (registry: FieldRegistry) => T = read,
): T {
  return useSyncExternalStore(
    registry.subscribe,
    () => read(registry),
    () => server(registry),
  );
}

export const hasControl = (registry: FieldRegistry) => registry.hasControl();
export const hasCounter = (registry: FieldRegistry) => registry.hasCounter();
export const readStepper = (registry: FieldRegistry) => registry.stepper();

/**
 * Publishes a Field.NumberInput's entry, for Field.Increment and
 * Field.Decrement. One input's entry replaces another's, with a warning in
 * development, and an input that goes away withdraws only its own entry, so
 * the one that replaced it is left.
 */
export function usePublishStepper(registry: FieldRegistry, entry: StepperEntry): void {
  const [owner] = useState(() => ({}));
  useLayoutEffect(() => {
    if (registry.publishStepper(owner, entry)) {
      warnOnce('number-input-twice', 'Field.Root holds more than one Field.NumberInput, so Field.Increment and Field.Decrement step only the last one. Give each its own Field.Root.');
    }
  }, [registry, owner, entry]);
  useLayoutEffect(() => () => registry.withdrawStepper(owner), [registry, owner]);
}
