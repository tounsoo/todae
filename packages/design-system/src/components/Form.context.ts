import { createContext, useContext, useLayoutEffect } from 'react';
import type { FormFieldError, ValidityCarrier } from './validity.js';

/** Errors you found, keyed by a control's `name`, such as a server's reply. */
export type FormErrors = Readonly<Record<string, string>>;

/** The server errors an edit has hidden: `names` only count while `errors` is the object they were hidden in. */
export type Dismissal = { errors: FormErrors | undefined; names: ReadonlySet<string> };

/** One control of a scope as the scope last read it. */
export type Reading = {
  carrier: ValidityCarrier;
  name: string;
  /** What the browser says is wrong, in Todae's words; null when the control is valid. */
  native: FormFieldError | null;
  /** The control's name for a person, for Form.Summary. */
  label: string;
};

/** A scope that shows an error, as Form.Summary lists it. */
export type SummaryEntry = { scopeId: string; error: FormFieldError; label: string; carrier: ValidityCarrier };

/**
 * The scopes' errors, for Form.Summary and Root's focus. A scope reports what
 * it shows after each commit; the summary lists the ones that were failing at
 * the last attempt, so a field edited into a new problem later doesn't join it.
 */
export type FormStore = {
  report: (scopeId: string, entry: SummaryEntry | null) => void;
  /** Lists the scopes failing now (`failing`), or none, until the next call. */
  freeze: (listed: 'failing' | 'none') => void;
  subscribe: (listener: () => void) => () => void;
  /** The listed entries still failing, in document order. */
  getSnapshot: () => readonly SummaryEntry[];
  /** Form.Summary's element while it renders one. */
  setSummary: (node: HTMLElement | null) => void;
  summary: () => HTMLElement | null;
};

export function createFormStore(): FormStore {
  const entries = new Map<string, SummaryEntry>();
  const listeners = new Set<() => void>();
  let listed: ReadonlySet<string> = new Set();
  let summary: HTMLElement | null = null;
  let snapshot: readonly SummaryEntry[] = [];
  const update = () => {
    const next = [...entries.values()]
      .filter((entry) => listed.has(entry.scopeId))
      .sort((a, b) => (a.carrier.compareDocumentPosition(b.carrier) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const same = next.length === snapshot.length && next.every((entry, i) => entry === snapshot[i]);
    if (same) return;
    snapshot = next;
    for (const listener of listeners) listener();
  };
  return {
    report(scopeId, entry) {
      if (entry) entries.set(scopeId, entry);
      else if (!entries.delete(scopeId)) return;
      update();
    },
    freeze(mode) {
      listed = new Set(mode === 'failing' ? entries.keys() : []);
      update();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    setSummary(node) {
      summary = node;
    },
    summary: () => summary,
  };
}

export type FormContextValue = {
  /** Submit attempts since the last reset. */
  attempt: number;
  /** Resets so far: a scope's reveal from an earlier one no longer counts. */
  epoch: number;
  errors: FormErrors | undefined;
  dismissal: Dismissal;
  /** Hides the server error of a name until the next submit, or until `errors` is a new object. */
  dismiss: (name: string) => void;
  store: FormStore;
};

export const FormContext = /* @__PURE__ */ createContext<FormContextValue | null>(null);

/** What a Field.Group or Fieldset.Root inside a Form.Root gives its controls and its ErrorMessage. */
export type ValidationScopeValue = {
  /** The id ErrorMessage.Root takes in auto mode. */
  id: string;
  /** What the scope shows now. */
  error: FormFieldError | null;
  /** Re-reads the scope's controls after this commit, once however often it is called. */
  revalidate: () => void;
  /** An auto ErrorMessage.Root mounted in the scope; returns its cleanup. */
  registerMessage: () => () => void;
};

export const ValidationScopeContext = /* @__PURE__ */ createContext<ValidationScopeValue | null>(null);

/** Re-reads the nearest scope's controls after every commit of the caller: a value set with no event still changes validity. */
export function useRevalidate(): void {
  const scope = useContext(ValidationScopeContext);
  const revalidate = scope?.revalidate;
  useLayoutEffect(() => revalidate?.());
}
