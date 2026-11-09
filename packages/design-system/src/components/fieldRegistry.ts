import { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { warnOnce } from '../internal/warnOnce.js';

/**
 * What a control is to its field. A `control` (anything wired with `useField`)
 * owns the field's id, description and focus. A `picker` (Field.Picker's
 * button) owns them only while no `control` is in the field.
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

/** What a typed input's value is, which a Field.Picker beside it takes its default name and glyph from. */
export type FieldPicks = 'date' | 'time' | 'dateTime' | 'dateRange';

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
 * counts, the number input step buttons reach, what a typed input holds,
 * and its value inputs. Parts register once, from a ref or a layout effect,
 * never during render (the two exceptions are `seedText` and `seedPicks`,
 * below), and every reader subscribes through
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
  /** The toggle of the picker whose button is `node`, if it is one, here or in a field nested inside. */
  toggleFor: (node: Element | null | undefined) => (() => void) | undefined;
  /** Adds the registry of a Field.Root nested inside this one, so `toggleFor` finds its pickers; the result removes it. */
  addChild: (child: FieldRegistry) => () => void;
  /** Counts a Field.Counter; the result uncounts it. */
  addCounter: () => () => void;
  hasCounter: () => boolean;
  /**
   * Publishes, or with null withdraws, `owner`'s text. The counter counts the
   * text control that mounted last, and the one before it once that one goes.
   */
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
  /** Publishes, or with null withdraws, what `owner`'s typed input holds. */
  publishPicks: (owner: object, picks: FieldPicks | null) => void;
  /** What the typed input that mounted last holds, once committed. */
  picks: () => FieldPicks | null;
  /** As seedText: what a typed input rendered with, for a Field.Picker's server snapshot. */
  seedPicks: (picks: FieldPicks) => void;
  serverPicks: () => FieldPicks | null;
  /** Hears a person's pick in a Field.Picker of the field; the result stops hearing. */
  onPick: (listener: () => void) => () => void;
  /** Tells the field's typed inputs that a person picked, so a pick replaces what was typed, even a pick of the value already set. */
  picked: () => void;
  /** Hears a typed input of the field become read-only or editable; the result stops hearing. */
  onEditableChange: (listener: () => void) => () => void;
  /** Tells the field a typed input became read-only or editable, so Field.Root moves its customValidity to what a form checks. */
  editableChanged: () => void;
  /** The last picker to mount, for a press on a read-only typed input. */
  lastPicker: () => HTMLElement | null;
  /** Registers a value input of the field; the result unregisters it. */
  addValueInput: (input: HTMLInputElement) => () => void;
  /** The field's first value input in the document, in document order. */
  firstValueInput: () => HTMLInputElement | null;
};

// Insertion order is mount order, so the last entry is the one that mounted last.
function lastEntry<T>(entries: Map<object, T>): T | null {
  let last: T | null = null;
  for (const entry of entries.values()) last = entry;
  return last;
}

const sameText = (a: TextEntry | null, b: TextEntry) => a !== null && a.value === b.value && a.maxLength === b.maxLength;

// One per Field.Root. Its methods live on the prototype and each collection is made on first use, so a
// field pays only for the parts it holds, however many kinds of part the registry serves.
class Store implements FieldRegistry {
  private listeners?: Set<() => void>;
  // Insertion order is mount order: a control that attaches again moves to the end.
  private controls?: Map<object, FieldControlEntry>;
  private valueInputs?: Set<HTMLInputElement>;
  private counters = 0;
  // Insertion order is mount order: the last entry is the one counted.
  private texts?: Map<object, TextEntry>;
  private children?: Set<FieldRegistry>;
  private seed: TextEntry | null = null;
  // Whether a text was ever committed: from then on, render seeds nothing.
  private committed = false;
  private stepperEntry: { owner: object; entry: StepperEntry } | null = null;
  private pickEntries?: Map<object, FieldPicks>;
  private pickSeed: FieldPicks | null = null;
  private picksCommitted = false;
  private pickListeners?: Set<() => void>;
  private editableListeners?: Set<() => void>;

  // An own property, so useSyncExternalStore can take it unbound.
  readonly subscribe = (listener: () => void) => {
    (this.listeners ??= new Set()).add(listener);
    return () => {
      this.listeners!.delete(listener);
    };
  };

  private notify() {
    if (this.listeners) for (const listener of this.listeners) listener();
  }

  setControl(owner: object, entry: FieldControlEntry | null) {
    const controls = (this.controls ??= new Map());
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
    this.notify();
  }

  hasControl() {
    return this.controls ? [...this.controls.values()].some((entry) => entry.role === 'control') : false;
  }

  namedBy(except?: object) {
    return this.controls ? [...this.controls].some(([owner, entry]) => owner !== except && entry.takesName) : false;
  }

  focusTarget() {
    return this.lastOf('control') ?? this.lastOf('picker');
  }

  toggleFor(node: Element | null | undefined): (() => void) | undefined {
    if (!node) return undefined;
    if (this.controls) for (const entry of this.controls.values()) if (entry.node === node) return entry.toggle;
    if (this.children)
      for (const child of this.children) {
        const toggle = child.toggleFor(node);
        if (toggle) return toggle;
      }
    return undefined;
  }

  addChild(child: FieldRegistry) {
    const children = (this.children ??= new Set());
    children.add(child);
    return () => {
      children.delete(child);
    };
  }

  addCounter() {
    this.counters += 1;
    this.notify();
    return () => {
      this.counters -= 1;
      this.notify();
    };
  }

  hasCounter() {
    return this.counters > 0;
  }

  publishText(owner: object, entry: TextEntry | null) {
    if (!entry) {
      if (!this.texts?.delete(owner)) return;
    } else {
      const texts = (this.texts ??= new Map());
      const prev = texts.get(owner) ?? null;
      if (prev && sameText(prev, entry)) return;
      // The seed the server rendered with, when it matches, so hydration's markup stays the same object.
      texts.set(owner, sameText(this.seed, entry) ? this.seed! : entry);
      this.committed = true;
    }
    this.seed = null;
    this.notify();
  }

  text() {
    return this.texts ? lastEntry(this.texts) : null;
  }

  seedText(entry: TextEntry) {
    if (this.committed || sameText(this.seed, entry)) return;
    this.seed = entry;
  }

  serverText() {
    return this.text() ?? this.seed;
  }

  publishStepper(owner: object, entry: StepperEntry) {
    const stepper = this.stepperEntry;
    const replaced = stepper !== null && stepper.owner !== owner;
    if (stepper?.owner === owner && stepper.entry === entry) return false;
    this.stepperEntry = { owner, entry };
    this.notify();
    return replaced;
  }

  withdrawStepper(owner: object) {
    if (this.stepperEntry?.owner !== owner) return;
    this.stepperEntry = null;
    this.notify();
  }

  stepper() {
    return this.stepperEntry?.entry ?? null;
  }

  publishPicks(owner: object, entry: FieldPicks | null) {
    if (!entry) {
      if (!this.pickEntries?.delete(owner)) return;
    } else {
      const picks = (this.pickEntries ??= new Map());
      if (picks.get(owner) === entry) return;
      picks.set(owner, entry);
      this.picksCommitted = true;
    }
    this.pickSeed = null;
    this.notify();
  }

  picks() {
    return this.pickEntries ? lastEntry(this.pickEntries) : null;
  }

  seedPicks(entry: FieldPicks) {
    if (!this.picksCommitted) this.pickSeed = entry;
  }

  serverPicks() {
    return this.picks() ?? this.pickSeed;
  }

  onPick(listener: () => void) {
    const listeners = (this.pickListeners ??= new Set());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  picked() {
    if (this.pickListeners) for (const listener of [...this.pickListeners]) listener();
  }

  onEditableChange(listener: () => void) {
    const listeners = (this.editableListeners ??= new Set());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  editableChanged() {
    if (this.editableListeners) for (const listener of [...this.editableListeners]) listener();
  }

  lastPicker() {
    return this.lastOf('picker');
  }

  private lastOf(role: FieldControlRole): HTMLElement | null {
    let found: HTMLElement | null = null;
    if (this.controls) for (const entry of this.controls.values()) if (entry.role === role) found = entry.node;
    return found;
  }

  addValueInput(input: HTMLInputElement) {
    const inputs = (this.valueInputs ??= new Set());
    inputs.add(input);
    return () => {
      inputs.delete(input);
    };
  }

  firstValueInput() {
    let first: HTMLInputElement | null = null;
    if (this.valueInputs)
      for (const input of this.valueInputs) {
        if (!input.isConnected) continue;
        if (!first || first.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_PRECEDING) first = input;
      }
    return first;
  }
}

export function createFieldRegistry(): FieldRegistry {
  return new Store();
}

/**
 * One answer from the registry, re-read when it changes. `server` is the
 * answer the server rendered with, which hydration must repeat: the server
 * knows of no control, counter or stepper, since they register on commit, and
 * a part that hydrates late (in a Suspense boundary) must not read what the
 * client's registry learned meanwhile.
 */
export function useRegistryValue<T>(
  registry: FieldRegistry,
  read: (registry: FieldRegistry) => T,
  server: (registry: FieldRegistry) => T,
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
/** The server snapshot of every yes-or-no question: nothing has registered there. */
export const serverNo = () => false;

export const readPicks = (registry: FieldRegistry) => registry.picks();
export const readServerPicks = (registry: FieldRegistry) => registry.serverPicks();

/** Publishes what a typed input holds, for a Field.Picker beside it, and seeds it for the server's render. */
export function usePublishPicks(registry: FieldRegistry, entry: FieldPicks): void {
  const [owner] = useState(() => ({}));
  registry.seedPicks(entry);
  useLayoutEffect(() => registry.publishPicks(owner, entry), [registry, owner, entry]);
  useLayoutEffect(() => () => registry.publishPicks(owner, null), [registry, owner]);
}

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
